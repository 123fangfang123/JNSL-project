# 燕文物流 API 运单状态与尾程跟踪号查询工作流

**版本**: 1.0  
**创建日期**: 2026-10-19  
**最后更新**: 2026-10-19  
**状态**: ✅ 已验证

---

## 📋 工作流概述

本工作流用于通过燕文物流 API 批量查询 `order_shipment` 表中 YANWEN 运单的物流状态和尾程跟踪号，并将结果回写到数据库。

### **核心逻辑**
1. **从数据库获取待查询运单**：
   - 先查询 `orders` 表中 `order_status = 'shipped'` 的所有 `transaction_id`
   - 再查询 `order_shipment` 表，筛选 `transaction_id` 在上述列表中，且 `carrier = 'YANWEN'` 且 `shipment_status = 'created'` 且 `process_date` 在最近3个月内的运单
2. **调用物流轨迹查询 API**：批量获取物流轨迹状态和尾程跟踪号
3. **状态映射**：将燕文 API 状态码转换为数据库 `shipment_status` 枚举值
4. **回写数据库**：更新 `order_shipment` 表的 `shipment_status` 和 `dest_tracking` 字段
5. **生成异常报告**：对无 dest_tracking 的记录生成异常文件

### **适用场景**
- **定期同步“已制单”运单的最新状态**：查询状态为 `created` 的运单，确认是否已实际揽收并发出
- **获取尾程派送跟踪号**：补充缺失的 dest_tracking 信息（如 USPS、Swiss Post、RELAY、YANWEN）
- **发现异常运单**：识别长期处于 `created` 状态但未实际发出的运单
- **避免重复查询**：仅查询 `created` 状态的运单，已 `shipped` 或 `cancelled` 的运单无需重复处理

---

## 🔧 前置条件

### **API 凭据**
| 项目 | 值 | 获取方式 |
|------|---|---------|
| 用户 ID | 见凭据文件 | 燕文物流提供 |
| 用户账号 TOKEN | 见凭据文件 | 燕文物流提供 |
| API Endpoint | `http://api.track.yw56.com.cn/api/tracking` | 燕文 API 文档 |

> ⚠️ 凭据文件位置：`customer_portal/燕文API KEY.txt`

### **数据库访问**
- Supabase 连接信息见 `source/.env.local`
- 目标表：`order_shipment`

### **依赖环境**
- Node.js（支持 `http` 模块，Node 14+）
- `@supabase/supabase-js` 包（`tools/node_modules` 中已安装）

---

## 📡 API 接口说明

### **物流轨迹查询 — 单一接口完成所有查询**

**用途**：获取运单的物流轨迹状态、尾程跟踪号、派送商信息

**请求方式**：GET

**请求地址**：
```
http://api.track.yw56.com.cn/api/tracking?nums=物流单号1,物流单号2,...
```

**请求头**：
```
Authorization: 用户ID（如：20225413）
```

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nums | String | 是 | 支持燕文单号、尾程单号；最多30个，用","连接 |

**请求示例**：
```
http://api.track.yw56.com.cn/api/tracking?nums=UH183870291YP,UK902696115YP
Authorization: 20225413
```

**响应字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| code | int | 0-成功，1-失败 |
| message | string | 请求结果描述 |
| tracking_number | string | 请求单号 |
| waybill_number | string | 燕文单号 |
| exchange_number | string | **尾程单号**（写入 dest_tracking）✅ |
| last_mile_carrier | string | **尾程派送商名称** ✅ |
| last_mile_carrier_website | string | 尾程派送商官网 |
| checkpoints | array | 轨迹明细数组 |
| - tracking_status | string | 操作状态码（如OR10、LH20、LM40等） |
| - time_stamp | string | 操作时间（当地时间） |
| - time_zone | string | 时区 |
| - message | string | 轨迹描述 |
| - location | string | 操作地点 |
| - is_last_mile_checkpoint | int | 是否尾程服务商轨迹（0-否，1-是） |
| tracking_status | string | 最后操作状态码 |
| tracking_status_waybill | object | 包裹状态 |
| - level1 | string | 一级状态（10个状态） |
| - level2 | string | 二级状态（16个状态） |
| - level3 | string | 最后操作状态码 |
| origin_country | string | 始发国 |
| destination_country | string | 目的国 |

**限制**：
- 单次最多查询 30 个单号
- 建议使用用户ID作为Authorization

---

## 🔄 工作流程

### **步骤 1: 从数据库获取待查询运单**

```
查询 order_shipment 表
  └─ 筛选条件:
      ├─ carrier = 'YANWEN'
      ├─ shipment_status = 'created'（仅查询状态为"已制单"的运单）
      └─ process_date >= 当前日期 - 3个月（仅查询最近3个月的运单）
  └─ 获取字段: tracking_no, transaction_id, process_date, dest_tracking
  └─ 分页: 每页 1000 条（Supabase 默认限制）
```

**查询逻辑说明**：
- **为什么只查询 `shipment_status = 'created'`**：
  - 状态为 `created` 的运单表示"已制单但未实际发出"
  - 这些运单可能已经实际揽收并发出，但数据库中状态未更新
  - 通过燕文API查询可以获取最新状态和尾程跟踪号
  - 状态为 `shipped` 或 `cancelled` 的运单无需重复查询

- **为什么限制 `process_date` 为3个月以内**：
  - 避免查询过于久远的历史数据
  - 3个月内的运单更可能处于流转状态，需要状态更新
  - 超过3个月的运单通常已妥投或取消，无需频繁查询

**SQL 查询示例**：
```sql
SELECT tracking_no, transaction_id, process_date, dest_tracking
FROM order_shipment
WHERE carrier = 'YANWEN'
  AND shipment_status = 'created'
  AND process_date >= CURRENT_DATE - INTERVAL '3 months'
ORDER BY process_date DESC
```

**输出**：待查询的 tracking_no 列表（仅包含状态为 created 且最近3个月的运单）

### **步骤 2: 调用物流轨迹查询 API**

```
将 tracking_no 列表按 30 条一批分组
  └─ 逐批调用物流轨迹查询 API
  └─ 每批间隔 200ms（5 req/s，避免请求过快）
  └─ 解析 JSON 响应数据
  └─ 构建 resultMap: { tracking_no → { status, dest_tracking, last_mile_carrier, country, checkpoints } }
```

**输出**：所有运单的物流状态和尾程跟踪号映射

### **步骤 3: 状态映射**

将燕文 API 状态码转换为数据库 `shipment_status` 枚举值：

| API 状态码 | 含义 | DB shipment_status | 说明 |
|-----------|------|-------------------|------|
| OR10 | 订单已生成 | `created` | 仅创建信息，未实际发出 |
| OR14 | 尾程派送订单确认 | `created` | 已确认 |
| OR16 | 尾程创建订单成功 | `created` | 已创建 |
| OR30 | 订单已取消 | `cancelled` | 已取消 |
| OR35 | 发货截留成功 | `cancelled` | 已截留 |
| PU10 | 燕文已揽收 | `shipped` | 已揽收 |
| PU30 | 揽收失败 | `cancelled` | 异常 |
| SC*（SC38 除外） | 仓库处理阶段 | `shipped` | 运输中 |
| SC38 | 退件签收 | `returned` | 退件已签收 |
| S2xx, S3xx | 运输阶段 | `shipped` | 运输中 |
| EC*, IC* | 清关阶段 | `shipped` | 运输中 |
| LH* | 干线运输阶段 | `shipped` | 运输中 |
| LM10-LM35 | 尾程派送阶段 | `shipped` | 派送中 |
| LM40, LM45 | 妥投成功 | `shipped` | 已签收 |
| LM50 | 派送失败 | `shipped` | 异常 |
| LM54-LM90 | 异常状态 | `shipped` | 异常 |

> 📌 映射规则参考 `source/lib/admin/carrier-configs/carrier-shipment-config.ts` 中的 `API_STATUS_MAP['YANWEN']`（API 码 → 中文状态名）+ `SHIPMENT_STATUS_MAP['YANWEN']`（中文状态名 → DB 枚举）。
> 定时任务脚本 `tools/_yanwen_query_batch.js` 已统一调用该共享配置，不再维护本地私有映射表。

### **步骤 4: 回写数据库**

```
遍历所有 API 查询到的运单
  └─ 更新 order_shipment 表
      ├─ SET shipment_status = 映射后的状态值（必须更新）
      └─ SET dest_tracking = API 返回的 exchange_number（如果有）
  └─ 以 tracking_no 为匹配键
  └─ 逐条更新，记录成功/失败
```

**回写策略**：
- **所有查询到的运单都会更新 `shipment_status`**：因为这些运单原本状态都是 `created`，需要根据API返回的最新状态进行更新
- **如果有 `dest_tracking`，同时更新该字段**：API返回的 `exchange_number` 即为尾程跟踪号
- **如果API未返回 `dest_tracking`，不更新该字段**：保持原有值（通常为 NULL）

**回写逻辑说明**：
- 由于查询条件限制为 `shipment_status = 'created'`，这些运单原本就没有实际发出
- API查询后，如果状态变为 `shipped`（已揽收/运输中/派送中/已签收等），说明运单已实际发出
- 如果状态仍为 `created`，说明运单仍未发出
- 如果状态变为 `cancelled`，说明运单已取消

**数据流转**：
```
查询前: shipment_status = 'created', dest_tracking = NULL（通常）
  ↓
API查询: 获取最新状态和尾程跟踪号
  ↓
回写后: shipment_status = 'shipped'/'created'/'cancelled'
        dest_tracking = '尾程单号'（如果有）
```

### **步骤 5: 生成异常报告与 CSV 导出**

```
导出完整查询结果 → CSV 文件
  └─ 路径: Data Import/YANWEN_<日期范围>_tracking.csv
  └─ 字段: tracking_no, transaction_id, waybill_number, exchange_number,
           last_mile_carrier, tracking_status, level1_status, level2_status,
           origin_country, destination_country, checkpoint_count

筛选无 dest_tracking 的记录 → 异常文件
  └─ 路径: Data Import/YANWEN_no_dest_tracking_<YYYYMMDD_HHmmss>.csv
  └─ 文件名包含时间戳，便于追溯
```

### **步骤 6: 数据验证**

```
读取 CSV 文件（数据源）
  └─ 查询数据库对应 tracking_no 的记录
  └─ 逐条比对 shipment_status 和 dest_tracking
  └─ 输出验证报告:
      ├─ 匹配率
      ├─ 不匹配记录明细
      ├─ 数据库完整性检查（NULL 值、空字符串等）
      └─ 抽样比对展示
```

---

## ⚠️ 异常处理策略

### **API 层面**

| 异常场景 | 处理策略 | 说明 |
|---------|---------|------|
| API 返回 `code: 1` | 记录失败批次，继续处理下一批 | 不中断整体流程 |
| 单号不存在 | API 返回空 result，该单号无状态数据 | 记录为 NO_DATA |
| 请求频率超限 | 被限流或返回错误 | 控制 ≤5 req/s |
| 授权失败 (401) | 检查 Authorization 配置 | 使用用户ID而非TOKEN |

### **数据层面**

| 异常场景 | 处理策略 | 说明 |
|---------|---------|------|
| 无 dest_tracking 返回 | 仍更新 shipment_status，不更新 dest_tracking | 订单可能仍未发出或特殊渠道 |
| 数据库更新失败 | 记录错误信息，继续处理其他记录 | 逐条更新，单条失败不影响全局 |
| tracking_no 在数据库中不存在 | 跳过，不计入更新统计 | 可能是脏数据 |
| shipment_status 为 NULL | 不写入 status 字段，仅写入 dest_tracking | 避免 enum 校验错误 |
| 查询结果为空 | 记录日志，正常结束 | 表示没有符合条件的运单 |

### **网络层面**

| 异常场景 | 处理策略 | 说明 |
|---------|---------|------|
| 网络超时 | 捕获异常，记录失败批次 | 可重跑脚本覆盖 |
| Supabase 连接失败 | 立即中断并报错 | 检查网络连接和 API Key |

### **幂等性保证**
- 脚本可重复执行，后执行的结果会覆盖先前的结果
- 如果中途失败，修复问题后重新运行即可，不会造成数据重复

---

## 📊 燕文轨迹状态码完整参考

### **订单处理阶段 (OR*)**

| 状态码 | 英文含义 | 中文含义 | DB 映射 |
|--------|---------|---------|---------|
| OR10 | Order Processed | 订单已生成 | `created` |
| OR14 | End-of-trip Confirmation | 尾程派送订单确认 | `created` |
| OR16 | Label Created | 尾程创建订单成功 | `created` |
| OR30 | Order Cancelled | 订单已取消 | `cancelled` |
| OR35 | Interception Successful | 发货截留成功 | `cancelled` |

### **揽收阶段 (PU*)**

| 状态码 | 英文含义 | 中文含义 | DB 映射 |
|--------|---------|---------|---------|
| PU10 | Pickup Scan | 燕文已揽收 | `shipped` |
| PU30 | Pickup Failed | 揽收失败 | `shipped` |

### **仓库处理阶段 (SC*)**

| 状态码 | 英文含义 | 中文含义 | DB 映射 |
|--------|---------|---------|---------|
| SC00-SC20 | Facility Processing | 仓库处理 | `shipped` |
| SC21 | Exception | 异常件录入 | `shipped` |
| SC34-SC37 | Return Processing | 退件处理 | `shipped` |
| SC38 | Return Signed | 退件签收 | `returned` |
| SC40-SC45 | Carrier Info | 目的国承运商信息 | `shipped` |

### **运输阶段 (S2xx, S3xx)**

| 状态码 | 英文含义 | 中文含义 | DB 映射 |
|--------|---------|---------|---------|
| S201-S213 | Pre-flight Processing | 待发运/交航/起飞 | `shipped` |
| S301-S306 | Overseas Processing | 海外机场提货/清关/转运 | `shipped` |

### **清关阶段 (EC*, IC*)**

| 状态码 | 英文含义 | 中文含义 | DB 映射 |
|--------|---------|---------|---------|
| EC10-EC30 | Export Customs | 出口报关 | `shipped` |
| IC50-IC82 | Import Customs | 进口清关 | `shipped` |

### **干线运输阶段 (LH*)**

| 状态码 | 英文含义 | 中文含义 | DB 映射 |
|--------|---------|---------|---------|
| LH07-LH16 | Departure Processing | 机场海关/场站/打板 | `shipped` |
| LH20-LH26 | In Transit | 运输中 | `shipped` |
| LH30-LH49 | Arrival Processing | 到达/提货/理货 | `shipped` |
| LH55 | Missing | 确认干线丢件 | `shipped` |

### **尾程派送阶段 (LM*)**

| 状态码 | 英文含义 | 中文含义 | DB 映射 |
|--------|---------|---------|---------|
| LM03-LM25 | Last Mile Processing | 到达/离开派送点 | `shipped` |
| LM30 | Available for Pickup | 到达待取 | `shipped` |
| LM35 | Attempted Delivery | 尝试投递 | `shipped` |
| LM40 | Delivered | 妥投成功 | `shipped` |
| LM45 | Return Signed | 海外退件签收成功 | `shipped` |
| LM50 | Undelivered | 派送失败 | `shipped` |
| LM54-LM90 | Exception/Return | 异常/退件/丢失 | `shipped` |

---

## 📁 尾程派送商说明

| 派送商 | 说明 | 典型 dest_tracking 格式 |
|--------|------|------------------------|
| USPS | 美国邮政 | 9214490...（20-30位数字） |
| Swiss Post | 瑞士邮政 | 980617...（数字） |
| RELAY | Relay 物流 | RELRGT...（字母数字混合） |
| YANWEN | 燕文自营 | YWLAX...、YWJFK... 等 |
| Intelcom | 加拿大Intelcom | 字母数字混合 |

---

## 🛠️ 使用方法

### **批量查询并回写数据库**
```bash
cd customer_portal/tools
node update_yanwen_tracking.js
```

### **查询单个/多个运单**
```bash
cd customer_portal/tools
node query_yanwen_tracking.js
```

### **验证回写数据**
```bash
cd customer_portal/tools
# 可创建验证脚本
node verify_yanwen_writeback.js
```

---

## 📋 输出文件

### **完整查询结果 CSV**
- **路径**: `Data Import/YANWEN_<日期范围>_tracking.csv`
- **字段**:

| 字段 | 来源 | 说明 |
|------|------|------|
| tracking_no | 数据库 | 燕文运单号 |
| transaction_id | 数据库 | 交易 ID |
| waybill_number | API | 燕文单号 |
| exchange_number | API | 尾程单号（dest_tracking） |
| last_mile_carrier | API | 尾程派送商 |
| tracking_status | API | 当前状态码 |
| level1_status | API | 一级状态 |
| level2_status | API | 二级状态 |
| origin_country | API | 始发国 |
| destination_country | API | 目的国 |
| checkpoint_count | API | 轨迹总条数 |

### **异常记录文件**
- **路径**: `Data Import/YANWEN_no_dest_tracking_<YYYYMMDD_HHmmss>.csv`
- **内容**: 所有无 dest_tracking 的运单记录
- **用途**: 人工排查未实际发出的运单

---

## 📊 生产数据记录

### **2026 年 2 月 7 日 YANWEN 批量查询**

| 指标 | 数值 |
|------|------|
| 总运单数 | 77 |
| 数据库无 dest_tracking | 7 |
| API 查询成功 | 7（100%） |
| 获取到 dest_tracking | 5（71.4%） |
| 仍无 dest_tracking | 2（28.6%） |
| 回写成功 | 7（100%） |
| 回写失败 | 0 |

**状态分布**：

| 状态 | 数量 | 占比 |
|------|------|------|
| LM40（妥投） | 2 | 28.6% |
| LM50（派送失败） | 1 | 14.3% |
| LM85（包裹丢失） | 1 | 14.3% |
| LM25（派送中） | 1 | 14.3% |
| OR10（订单已生成） | 2 | 28.6% |

**尾程派送商分布**：

| 派送商 | 数量 | 占比 |
|--------|------|------|
| Swiss Post | 2 | 28.6% |
| USPS | 1 | 14.3% |
| RELAY | 1 | 14.3% |
| YANWEN | 1 | 14.3% |
| Intelcom | 1 | 14.3% |
| (无) | 2 | 28.6% |

---

## 🔍 异常运单分析

### **无 dest_tracking 的 2 条运单特征**

| 运单号 | API状态 | 特征 | 原因 |
|--------|---------|------|------|
| UK902696610YP | OR10 | 订单已生成 | 仅收到电子信息，未实际发出 |
| UK902696742YP | OR10 | 订单已生成 | 仅收到电子信息，未实际发出 |

**处理策略**：
- OR10 状态：持续跟踪，待状态变更后重新查询
- 其他异常状态：联系燕文客服确认运单实际情况

---

## 🔗 与物流商运单导入工作流的关系

本工作流与 `CARRIER_SHIPMENT_IMPORT_WORKFLOW.md`（物流商运单导入工作流）是**互补关系**：

| 对比项 | 本工作流（API 查询） | 运单导入工作流（Excel 导入） |
|--------|-------------------|------------------------|
| **数据来源** | 燕文 API 实时查询 | 物流商导出的 Excel 文件 |
| **更新方式** | 主动拉取最新状态 | 被动接收物流商推送的数据 |
| **适用场景** | 需要实时状态、获取尾程跟踪号 | 物流商提供批量数据文件时 |
| **状态精度** | API 实时数据，最准确 | 依赖物流商导出时间点的快照 |
| **dest_tracking** | 通过 API 的 exchange_number 获取 | 从 Excel 的"转单号"列读取 |
| **更新目标** | 仅更新 order_shipment 表 | 仅更新 order_shipment 表 |

**推荐组合使用**：
1. 先用 **Excel 导入工作流** 快速批量更新基础状态
2. 再用 **API 查询工作流** 补充尾程跟踪号和验证状态准确性

---

## 📝 注意事项

### **API 调用限制**
- 每次最多查询 30 个单号
- 建议请求频率 ≤5 req/s
- 使用用户ID作为Authorization（不是TOKEN）

### **数据库注意事项**
- `order_shipment` 表必须有对应的 tracking_no 记录才能更新
- `dest_tracking` 字段允许 NULL，兼容无尾程跟踪号的特殊情况
- `shipment_status` 为 TEXT 类型，值必须为合法枚举（created/shipped/cancelled）

### **特殊运单情况**
- OR10 状态运单属于"订单已生成"，尚未实际揽收，不返回 dest_tracking
- 这是正常行为，不是 API 错误

---

## 📂 相关文件

| 文件路径 | 说明 |
|---------|------|
| `tools/update_yanwen_tracking.js` | 批量查询 API 并回写数据库的主脚本 |
| `tools/query_yanwen_tracking.js` | 查询运单状态的辅助脚本 |
| `tools/query_yanwen_20260207.js` | 查询特定日期运单的脚本 |
| `tools/lib/admin/column-maps/carrier-shipment-config.js` | 物流商配置文件（状态映射） |
| `source/lib/admin/column-maps/carrier-shipment-config.ts` | 物流商配置文件（TypeScript版本） |
| `docs/API接口文档/燕文API接口文档.pdf` | 燕文 API 接口文档（旧版） |
| `燕文API KEY.txt` | API 认证凭据 |
| `Data Import/YANWEN_*.csv` | 查询结果文件 |
| `workflow/CARRIER_SHIPMENT_IMPORT_WORKFLOW.md` | 物流商运单 Excel 导入工作流 |

---

## 📌 更新日志

### **v1.0 (2026-10-19)**
- ✅ 初始版本发布
- ✅ 覆盖完整工作流：API 查询 → 状态映射 → 数据库回写 → 异常处理 → 数据验证
- ✅ 基于 7 条 YANWEN 运单实际验证
- ✅ 包含生产数据记录和异常分析
- ✅ 与物流商运单导入工作流的对比说明

---

**最后更新**: 2026-10-19  
**维护者**: Lingma AI Assistant  
**文档状态**: ✅ 已创建并验证
