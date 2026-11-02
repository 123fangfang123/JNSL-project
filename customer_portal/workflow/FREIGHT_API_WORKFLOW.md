# 多物流商运费 API 导入工作流（FREIGHT_API_WORKFLOW）

> 版本：v1.0 | 更新日期：2026-10-22
> 主调度器：`customer_portal/tools/freight_batch_import.js`

---

## 一、工作流概览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    多物流商运费统一调度工作流                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1                 Step 2                    Step 3          Step 4 │
│  ┌─────────────┐       ┌────────────────────┐    ┌──────────┐  ┌────────┐
│  │ 比对缺失运单 │       │ 按物流商分发到适配器 │    │ 写入freight│  │数据校验 │
│  │order_shipment│  ──▶  │                    │ ──▶│  表(upsert)│──▶│+异常报告│
│  │    ∉ freight │       │ ┌────┐┌────┐┌────┐ │    │          │  │        │
│  │              │       │ │ HH ││ YW ││ YUN │ │    │          │  │        │
│  └─────────────┘       │ └────┘└────┘└────┘ │    └──────────┘  └────────┘
│                         └────────────────────┘                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 支持的物流商

| 物流商 | DB carrier 值 | 适配器文件 | API 接口 | 费用拆分 |
|--------|--------------|-----------|---------|---------|
| 华翰 | `HH EXPRESS` | `adapter_hh.js` | getOrderFee + getBillingWeight | freight_fee / registered_fee / other_fee |
| 燕文 | `YANWEN` | `adapter_yanwen.js` | express.order.bill.getlist | 仅 freight（总价），拆分字段为 null |
| 云途 | `YUNExpress` | `adapter_yun.js` | /v1/order/fee-details/get | freight_fee / registered_fee / other_fee |

---

## 二、文件结构

```
customer_portal/tools/
├── freight_batch_import.js        # 主调度器（入口）
├── adapter_hh.js                  # HH EXPRESS 适配器
├── adapter_yanwen.js              # YANWEN 适配器
├── adapter_yun.js                 # YUNEXPRESS 适配器
├── lib/
│   ├── freight-db.js              # 共享 DB 模块（查询/写入/校验）
│   └── carrier-credentials.js     # API 凭据配置
├── _yanwen_freight_batch_upsert.js  # 燕文独立脚本（保留兼容）
├── _sync_yanwen_freight.js          # 燕文单日同步（保留兼容）
├── _query_hh_freight_info.js        # HH 单运单查询（保留兼容）
└── ...
customer_portal/reports/
└── freight_batch_report_*.json    # 每次执行生成的报告
```

---

## 三、数据库表结构

### 3.1 order_shipment 表（数据源）

| 字段 | 类型 | 说明 |
|------|------|------|
| tracking_no | text | 运单号（主键） |
| carrier | text | 物流商名称（`HH EXPRESS` / `YANWEN` / `YUNExpress`） |
| process_date | date | 交运日期 |
| shipment_status | text | 运单状态，筛选条件 `= 'shipped'` |
| dest_tracking | text | 尾程跟踪号，筛选条件 `IS NOT NULL` |
| transaction_id | text | 订单号 |
| channel_id | text | 渠道号 |

> **注意：** carrier 字段大小写敏感！`YUNExpress` 不能写成 `YUNEXPRESS`。

### 3.2 freight 表（目标表）

| 字段 | 类型 | 说明 |
|------|------|------|
| tracking_no | text | 运单号（主键） |
| billing_date | date | 结算日期 |
| weight_g | integer | 计费重量（克） |
| freight | numeric | 总运费 |
| freight_fee | numeric | 速递运费（燕文为 null） |
| registered_fee | numeric | 挂号费（燕文为 null） |
| other_fee | numeric | 其他费用（燕文为 null） |

---

## 四、详细步骤

### Step 1：比对缺失运单

**查询逻辑：**

从 `order_shipment` 中查询满足以下条件的运单：
1. `shipment_status = 'shipped'`
2. `dest_tracking IS NOT NULL`
3. `tracking_no` 不在 `freight` 表中

按 `carrier` 分组，得到每个物流商待处理的运单号列表。

**分页策略：**
- Supabase 单次查询上限 1000 条
- 使用 `offset + limit` 分页循环读取
- 分批检查 freight 表已存在的记录（每批 100 个运单号）

**异常处理：**
- 所有物流商均返回 0 条：输出"无待导入运单"，正常结束
- DB 连接失败：重试 3 次（指数退避），仍失败则终止

---

### Step 2：分发到适配器

主调度器按物流商分组后，依次启动对应适配器子进程：

1. 将运单号列表写入临时 JSON 文件（`os.tmpdir()`）
2. 启动适配器：`node adapter_xxx.js --input <tmpFile> [--dry-run]`
3. 注入 API 凭据到子进程环境变量
4. 收集适配器 stdout 最后一行的 JSON 结果
5. 执行完毕后删除临时文件

**适配器统一接口：**

| 参数 | 说明 |
|------|------|
| `--input <file>` | 从 JSON 文件读取运单号列表 |
| `--trackings "T1,T2"` | 直接传入运单号（调试用） |
| `--dry-run` | 仅查询不写入数据库 |

**适配器输出（JSON 到 stdout）：**

```json
{
  "success": 10,
  "no_billing": 3,
  "failed": 1,
  "records": [{ "tracking_no": "...", "billing_date": "...", ... }],
  "errors": [{ "tracking_no": "...", "error": "..." }],
  "no_billing_tracking_nos": ["..."]
}
```

---

### Step 3：写入 freight 表

由各适配器内部调用 `lib/freight-db.js` 的 `upsertFreightRecords()` 完成：

1. **API 记录去重**：若同一运单号在待写入列表中有多条记录，将所有费用列（freight / freight_fee / registered_fee / other_fee）求和合并为一条
2. 批量查询 freight 表中已存在的运单号及其费用字段（每批 100 个）
3. 不存在的 → `POST` 插入（每批 100 条）
4. 已存在的 → 比对 freight 表中该运单的 `freight` 总金额：
   - **金额相同** → 跳过，不更新
   - **金额不同** → 将所有费用列（freight / freight_fee / registered_fee / other_fee）与 DB 现有值求和后 `PATCH` 更新
5. DB 写入失败重试 3 次（指数退避）

> **示例：** API 返回同一运单两条记录：(freight=12, registered_fee=10) 和 (freight=-3, registered_fee=-5)，合并后写入 freight=9, registered_fee=5。若 DB 中已有 freight=9 的记录，则跳过不更新。

---

### Step 4：数据校验 + 异常报告

主调度器收集所有适配器结果后：

1. 调用 `validateFreightRecords()` 反查 DB 校验写入结果
2. 生成统一 JSON 报告到 `customer_portal/reports/`
3. 控制台输出汇总信息

---

## 五、各物流商 API 详细说明

### 5.1 HH EXPRESS（华翰）

**API 信息：**

| 项目 | 值 |
|------|-----|
| 地址 | `http://api.hh-exp.com/default/svc/web-service` |
| 协议 | SOAP XML（callService 封装） |
| 接口 | `getOrderFee`（费用）+ `getBillingWeight`（重量） |
| 查询方式 | 逐单查询 |
| 限流 | 每 5 次调用暂停 1 秒 |

**getOrderFee 请求/响应：**

```json
// 请求
{ "reference_no": "HHWPZ6289106401YQ" }

// 响应
{
  "ask": "Success",
  "data": {
    "total_price": "109.93",
    "details": [
      { "fee_name": "速递运费", "price": "77.93", "create_date": "2026-10-18 00:23:24" },
      { "fee_name": "挂号费", "price": "32.00", "create_date": "2026-10-18 00:23:24" }
    ]
  }
}
```

**getBillingWeight 请求/响应：**

```json
// 请求
{ "codes": ["HHWPZ6289106401YQ"] }

// 响应
{ "ask": "Success", "Data": [{ "Code": "HHWPZ6289106401YQ", "chargeweight": "0.523" }] }
```

**字段映射：**

| freight 字段 | 提取逻辑 |
|-------------|---------|
| tracking_no | 运单号直接使用 |
| billing_date | `details[0].create_date.split(' ')[0]` |
| weight_g | `Math.round(parseFloat(chargeweight) * 1000)`（KG→g） |
| freight | `Math.round(parseFloat(total_price) * 100) / 100` |
| freight_fee | `Σ(details[fee_name="速递运费"].price)`，保留两位小数 |
| registered_fee | `Σ(details[fee_name="挂号费"].price)`，保留两位小数 |
| other_fee | `Math.round((freight - freight_fee - registered_fee) * 100) / 100` |

---

### 5.2 YANWEN（燕文）

**API 信息：**

| 项目 | 值 |
|------|-----|
| 地址 | `https://open.yw56.com.cn/api/order` |
| 协议 | REST JSON + MD5 签名 |
| 接口 | `express.order.bill.getlist` |
| 查询方式 | 批量查询（每批 50 个运单号） |
| 限流 | 批次间隔 200ms |

**签名算法：**

```
raw = API_TOKEN + USER_ID + jsonData + "json" + method + timestamp + "V1.0" + API_TOKEN
sign = MD5(raw)  // 32位小写
```

**请求/响应：**

```json
// 请求
{ "waybillNumbers": ["UL606876914YP", "UL606750896YP"] }

// 响应
{
  "success": true,
  "data": [{
    "waybillNumber": "UL606876914YP",
    "dateOfBill": "2026-10-18 00:00:00",
    "calcWeight": "1352",
    "arOriPrice": 145.9
  }]
}
```

**字段映射：**

| freight 字段 | 提取逻辑 |
|-------------|---------|
| tracking_no | `waybillNumber` |
| billing_date | `dateOfBill.split(' ')[0]` |
| weight_g | `parseInt(calcWeight)`（单位已是 g） |
| freight | `parseFloat(arOriPrice)`（总运费） |
| freight_fee | `null`（燕文 API 不提供拆分） |
| registered_fee | `null` |
| other_fee | `null` |

**已知问题：**
- API 间歇性返回 `code: 5001, message: "系统异常"`，已增加重试逻辑（最多 2 次，间隔 3s/6s）
- 未出账单的运单返回空数组（`data: []`），不是报错，记录到 no_billing 列表

---

### 5.3 YUNEXPRESS（云途）

**API 信息：**

| 项目 | 值 |
|------|-----|
| 地址 | `https://openapi.yunexpress.cn` |
| 协议 | OAuth2 accessToken + HmacSHA256 签名 |
| 接口 | `GET /v1/order/fee-details/get` |
| 查询方式 | 逐单查询 |
| 限流 | 每次调用间隔 200ms |

**认证流程（两步）：**

1. **获取 accessToken**：`POST /openapi/oauth2/token`
   ```json
   { "grantType": "client_credentials", "appId": "...", "appSecret": "..." }
   // 响应：{ "accessToken": "...", "expiresIn": 7200 }
   ```

2. **签名请求头**：每次 API 调用需三个 header
   - `token`: accessToken
   - `date`: 毫秒时间戳
   - `sign`: `Base64(HmacSHA256(content, appSecret))`
   - GET 签名内容：`date={ms}&method=GET&uri=/v1/order/fee-details/get?waybill_number=XXX`

**请求/响应：**

```
GET /v1/order/fee-details/get?waybill_number=YT2620400707870554
```

```json
{
  "success": true,
  "result": {
    "waybill_number": "YT2620400707870554",
    "transaction_date": "2026-08-03 23:00:00",
    "total_amount": 302.3,
    "charge_weight": 2.6,
    "fee_details": [
      { "fee_name": "速递运费", "amount": 208, "currency": "RMB" },
      { "fee_name": "挂号费", "amount": 40, "currency": "RMB" },
      { "fee_name": "增值税", "amount": 3, "currency": "USD", "deduction_amount": 20.3 },
      { "fee_name": "清关处理费", "amount": 34, "currency": "RMB" }
    ]
  }
}
```

**字段映射：**

| freight 字段 | 提取逻辑 |
|-------------|---------|
| tracking_no | `waybill_number` |
| billing_date | `transaction_date.split(' ')[0]` |
| weight_g | `Math.round(parseFloat(charge_weight) * 1000)`（KG→g） |
| freight | `Math.round(total_amount * 100) / 100` |
| freight_fee | `Σ(fee_details[fee_name="速递运费"].amount)`，保留两位小数 |
| registered_fee | `Σ(fee_details[fee_name="挂号费"].amount)`，保留两位小数 |
| other_fee | `Σ(其余费用项的 deduction_amount 或 amount)`，保留两位小数 |

**多币种处理：**
- 非 RMB 币种的费用项使用 `deduction_amount`（实际扣费金额）
- RMB 币种的费用项直接使用 `amount`

**冲正记录处理：**
- fee_details 中可能包含负数金额（冲正/退款）
- 同一 fee_name 的所有条目**求和**（含负数），得到最终结算金额

---

## 六、异常处理策略

### 6.1 API 异常

| 异常类型 | 物流商 | 处理策略 |
|----------|--------|----------|
| 运单不存在 | HH/YUN | 跳过，记录到 no_billing |
| 费用未出 | HH/YANWEN/YUN | 跳过，记录到 no_billing |
| 5001 系统异常 | YANWEN | 重试 2 次（间隔 3s/6s），仍失败记录到 errors |
| Token/签名过期 | YUN | 自动刷新 accessToken 重试 |
| 网络超时 | ALL | 重试（HH 2次，YANWEN 2次，YUN 3次） |
| 认证失败 | ALL | 终止，输出错误提示 |
| 限流 | HH | 每 5 次调用暂停 1 秒 |

### 6.2 数据库异常

| 异常类型 | 处理策略 |
|----------|----------|
| 连接失败 | 重试 3 次（指数退避），仍失败终止 |
| 唯一键冲突 | 智能合并：freight 相同跳过，不同则费用求和更新 |
| URL 过长 | 分块查询（每块 100 个运单号） |

---

## 七、异常报告

### 7.1 报告文件

每次执行生成 JSON 报告到 `customer_portal/reports/freight_batch_report_YYYYMMDD_HHmmss.json`

### 7.2 报告结构

```json
{
  "report_time": "2026-10-22T10:30:00.000Z",
  "dry_run": false,
  "carriers": ["HH EXPRESS", "YANWEN", "YUNExpress"],
  "summary": {
    "total_missing": 14029,
    "carriers": {
      "HH EXPRESS": {
        "requested": 2132,
        "success": 2000,
        "no_billing": 100,
        "failed": 32,
        "errors": [],
        "no_billing_tracking_nos": []
      },
      "YANWEN": { "..." : "..." },
      "YUNExpress": { "..." : "..." }
    },
    "validation": {
      "pass": 13500,
      "fail": 50,
      "pass_rate": "99.6%",
      "failures": []
    }
  },
  "elapsed_seconds": 5400.0
}
```

---

## 八、执行方式

### 8.1 全量导入

```bash
cd customer_portal/tools
node freight_batch_import.js
```

### 8.2 Dry-run（仅查询不写入）

```bash
node freight_batch_import.js --dry-run
```

### 8.3 指定物流商

```bash
# 仅处理华翰
node freight_batch_import.js --carriers HH

# 处理华翰和燕文
node freight_batch_import.js --carriers HH,YANWEN

# 仅处理云途
node freight_batch_import.js --carriers YUN
```

> `--carriers` 支持别名：HH / HH_EXPRESS → HH EXPRESS，YUN / YUNEXPRESS → YUNExpress

### 8.4 单独运行适配器（调试用）

```bash
# HH 单运单测试
node adapter_hh.js --trackings "HHWPZ6289106401YQ" --dry-run

# YANWEN 批量测试
node adapter_yanwen.js --trackings "UL606876914YP,UL606750896YP" --dry-run

# YUNEXPRESS 单运单测试
node adapter_yun.js --trackings "YT2620400707870554" --dry-run

# 从文件读取运单号（调度器使用的方式）
node adapter_hh.js --input /tmp/trackings.json --dry-run
```

---

## 九、已知陷阱与注意事项

### 通用

1. **carrier 名称大小写敏感**：DB 中为 `YUNExpress`（混合大小写），Supabase `eq` 过滤器严格匹配，写错大小写会静默返回 0 条
2. **浮点精度**：JavaScript 浮点运算产生如 `38.989999999999995`，写入 DB 前必须 `Math.round(x * 100) / 100`
3. **Supabase 分页限制**：单次查询最多 1000 条，必须分页循环
4. **Supabase IN 查询 URL 长度**：批量 `in.(...)` 查询需分块（每块 100 个），否则 URL 超长报错
5. **临时文件传递**：运单号超过 ~200 个时命令行超长，改用临时 JSON 文件传递
6. **同运单多条记录求和**：API 可能对同一运单返回多条费用记录（含冲正/退款），写入前自动将所有费用列求和合并为一条
7. **已有记录智能合并**：写入 DB 时，若 freight 表中已存在该运单且 freight 总金额相同则跳过不更新；金额不同则将费用列求和后更新（不是覆盖）

### HH EXPRESS

6. **同类型费用多条求和**：API 可能返回多条"速递运费"（含调整/退款），必须 `+=` 求和
7. **负值费用**：费用调整产生负值是正常的，求和后 total 仍为正
8. **重量单位**：API 返回 KG，DB 存储 g，需 ×1000
9. **other_fee 为计算值**：API 不直接返回，需 `total - freight_fee - registered_fee`

### YANWEN

10. **5001 间歇错误**：燕文 API 偶发返回 `code: 5001`，已加重试机制
11. **费用无拆分**：API 只提供总价 `arOriPrice`，`freight_fee`/`registered_fee`/`other_fee` 均为 null
12. **未出账单**：返回空数组（非报错），记录到 no_billing 列表

### YUNEXPRESS

13. **逐单查询**：API 每次只能查一个运单号，大量运单耗时较长
14. **多币种**：部分费用为外币（如 USD），需使用 `deduction_amount` 而非 `amount`
15. **冲正记录**：fee_details 可能含负数金额，同一 fee_name 需全部求和
16. **Token 缓存**：accessToken 有效期 7200 秒，提前 60 秒刷新
17. **签名 uri 精确匹配**：GET 请求的 uri 必须包含完整 query string
