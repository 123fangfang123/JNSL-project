# GC 运单同步工作流（created → shipped）

**版本**: 1.1
**创建日期**: 2026-11-03
**状态**: ✅ 已执行（线上库 29 条写入成功）

---

## 📋 工作流概述

本工作流用于把 `order_shipment` 表中物流商为 `GC`、状态为 `created` 的运单批量置为 `shipped`，同时把 `tracking_no` 写入 `dest_tracking`。

与华翰 / 燕文 / 云途工作流不同，本工作流**不调用物流商 API**，只做库内字段同步。

### **核心逻辑**

1. 查询 `order_shipment`，筛选 `carrier = 'GC'` 且 `shipment_status = 'created'`
2. 对每条运单：`dest_tracking = tracking_no`
3. 同一条 UPDATE 中把 `shipment_status` 改为 `shipped`
4. 写后读回校验（影响行数必须为 1，两个字段值必须与期望一致）

### **等价的 SQL**

```sql
UPDATE order_shipment
SET dest_tracking = tracking_no,
    shipment_status = 'shipped'
WHERE carrier = 'GC'
  AND shipment_status = 'created';
```

---

## 🔄 执行流程

### **步骤 1: 查询待处理运单**

```sql
SELECT tracking_no, transaction_id, process_date, shipment_status, carrier, dest_tracking
FROM order_shipment
WHERE carrier = 'GC'
  AND shipment_status = 'created'
ORDER BY process_date ASC, tracking_no ASC;
```

- 分页每页 1000 条（服务端 `max_rows = 1000`，用 `range()` 分批）
- 只读筛选，不做关联查询

### **步骤 2: 逐条更新**

匹配条件使用 `tracking_no + carrier + process_date + shipment_status = 'created'`，避免误伤同名运单，并防止把并发修改后的运单覆盖回 `shipped`。

```js
const patch = { dest_tracking: row.tracking_no, shipment_status: 'shipped' };
```

- 并发 50/批
- 每条 UPDATE 追加 `.select()` 写后读回
- 影响行数 ≠ 1、或读回值不符 → 记为失败，退出码 1

### **步骤 3: 汇总**

脚本输出「已写入 / 已一致 / 失败」三项统计和失败明细。

---

## 🛠️ 使用方法

```powershell
cd customer_portal

# 1. dry-run，只打印待写入差异（默认）
node tools/_gc_shipment_sync.js

# 2. 确认后实际写入
node tools/_gc_shipment_sync.js --write

# 3. 只处理指定运单
node tools/_gc_shipment_sync.js --write --only=YT2639121438304383,YT2639121438332180
```

---

## 🛡️ 安全规则

| # | 规则 | 目的 |
|---|---|---|
| 1 | 默认 dry-run，必须显式 `--write` 才落库 | 防止误执行改库 |
| 2 | 更新条件包含 `shipment_status = 'created'` | 不会重复覆盖已变成 `shipped` 的运单 |
| 3 | 匹配条件为 `tracking_no + carrier + process_date` | 防止误伤其他物流商 / 同名运单 |
| 4 | 写后读回，影响行数必须恰为 1 | 失败不会被静默吞掉 |
| 5 | 两字段已与期望一致时跳过 | 幂等，重复执行提交 0 条 UPDATE |

> `dest_tracking` 会被写成 `tracking_no` 的值。若某条 GC 运单的 `dest_tracking` 已有其他尾程号，执行前请先用 dry-run 核对。

---

## 📊 当前数据（2026-11-03）

### **线上库 `rmvgmfheobcnsbwevokt` 执行前**

| 指标 | 数量 |
|---|---|
| `carrier = 'GC'` 总数 | 31 |
| `shipment_status = 'created'` | 29 |
| 其中 `dest_tracking` 非空 | 0 |
| 待写入 | **29** |
| `process_date` 范围 | 2026-08-03 ~ 2026-08-20 |

### **线上库执行结果**

| 阶段 | 结果 |
|---|---|
| dry-run | 待写入 29 条 |
| `--write` | 已写入 **29** 条，失败 0 |
| 写后验证 | `created` = 0；`shipped` = 29；`cancelled` = 2；`dest_tracking = tracking_no` = 29；不一致 0 |

> 本地库 `xogpaptciobeonditjry` 已完成 dry-run 验证（同样 29 条），实际写入由用户自行执行。

### **定向执行线上库**

```powershell
$env:SUPABASE_URL="https://rmvgmfheobcnsbwevokt.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<线上 service_role key>"
node tools/_gc_shipment_sync.js --write
```

脚本读取 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 环境变量优先，未设置时回退到 `.env.local`。

---

## 📂 相关文件

| 文件路径 | 说明 |
|---|---|
| `tools/_gc_shipment_sync.js` | 主脚本（dry-run 默认，`--write` 落库，写后读回校验） |
| `workflow/CARRIER_SHIPMENT_IMPORT_WORKFLOW.md` | 物流商运单 Excel 导入工作流 |
| `workflow/CARRIER_SHIPMENT_HH_API_WORKFLOW.md` | 华翰 API 工作流 |
| `workflow/CARRIER_SHIPMENT_YANWEN_API_WORKFLOW.md` | 燕文 API 工作流 |
| `workflow/CARRIER_SHIPMENT_YUNEXPRESS_API_WORKFLOW.md` | 云途 API 工作流 |

---

**最后更新**: 2026-11-03
**文档状态**: ✅ 线上库已执行并验证通过
