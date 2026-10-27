# 华翰运费 API 导入工作流（FREIGHT_HH_API_WORKFLOW）

> 版本：v2.1 | 更新日期：2026-10-22 | 文件：FREIGHT_HH_API_WORKFLOW.md
> 脚本位置：`customer_portal/tools/_hh_freight_batch_upsert.js`

---

## 一、工作流概览

```
┌──────────────────────────────────────────────────────────────────┐
│                      华翰运费导入工作流                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1              Step 2              Step 3           Step 4 │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐    ┌────────┐│
│  │ 查询运单号 │ ───▶ │ 调用华翰API │ ───▶ │ 写入freight│──▶ │ 数据校验 ││
│  │order_ship │       │getOrderFee │       │  表(upsert)│   │+异常报告││
│  │  ment表    │       │getBillingWt│       │           │    │       ││
│  └──────────┘       └──────────┘       └──────────┘    └────────┘│
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、数据库表结构

### 2.1 order_shipment 表（数据源）

| 字段 | 类型 | 说明 |
|------|------|------|
| tracking_no | text | 华翰运单号（主键之一） |
| carrier | text | 物流商名称，筛选条件 `= 'HH EXPRESS'` |
| process_date | date | 交运日期，筛选条件 `>= 最近3个月` |
| dest_tracking | text | 尾程跟踪号，筛选条件 `IS NOT NULL AND != ''` |

### 2.2 freight 表（目标表）

| 字段 | 类型 | 说明 | 数据来源 |
|------|------|------|----------|
| tracking_no | text | 运单号（唯一键） | order_shipment.tracking_no |
| billing_date | date | 结算日期 | getOrderFee → details[0].create_date |
| weight_g | integer | 计费重量（克） | getBillingWeight → chargeweight × 1000 |
| freight | numeric | 总运费 | getOrderFee → total_price |
| freight_fee | numeric | 速递运费 | getOrderFee → details 中 fee_name="速递运费" 的 price 之和 |
| registered_fee | numeric | 挂号费 | getOrderFee → details 中 fee_name="挂号费" 的 price 之和 |
| other_fee | numeric | 其他费用 | freight - freight_fee - registered_fee（计算值） |

---

## 三、详细步骤

### Step 1：从 order_shipment 查询运单号

**查询条件：**

```sql
SELECT tracking_no
FROM order_shipment
WHERE carrier = 'HH EXPRESS'
  AND process_date >= CURRENT_DATE - INTERVAL '3 months'
  AND dest_tracking IS NOT NULL
  AND dest_tracking != ''
```

**规则：**
- 物流商固定为 `HH EXPRESS`
- 交运时间范围为最近 3 个月（滚动窗口）
- 必须有尾程跟踪号（dest_tracking），无尾程的运单不产生运费
- 分页查询，每页 100 条，避免 Supabase 单次查询限制

**异常处理：**
- 查询返回 0 条：记录日志，工作流正常结束，输出"无待导入运单"
- 数据库连接失败：重试 3 次，间隔 5 秒，仍失败则终止并输出错误

---

### Step 2：调用华翰 API 查询运费信息

对 Step 1 查出的每个运单号，并行调用两个 API：

#### 2.1 getOrderFee（费用查询）

**请求参数：**
```json
{ "reference_no": "HHWPZ6289106401YQ" }
```

**返回结构：**
```json
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

**字段提取规则：**

| freight 字段 | 提取逻辑 | 说明 |
|-------------|---------|------|
| billing_date | `details[0].create_date.split(' ')[0]` | 取第一条费用的创建日期 |
| freight | `parseFloat(data.total_price)` | 总费用 |
| freight_fee | `Σ(details[fee_name="速递运费"].price)` | 同一费用项可能有多条，**必须求和** |
| registered_fee | `Σ(details[fee_name="挂号费"].price)` | 同上，必须求和 |
| other_fee | `freight - freight_fee - registered_fee` | 计算值，保留两位小数 |

> **重要：** 华翰 API 可能对同一运单返回多条同类型费用（如费用调整/退款），
> 必须对所有同类型费用**求和**，而非取最后一条。
> 例：速递运费 373.05 + (-13.61) = 359.44

#### 2.2 getBillingWeight（计费重量查询）

**请求参数：**
```json
{ "codes": ["HHWPZ6289106401YQ"] }
```

**返回结构：**
```json
{
  "ask": "Success",
  "Data": [{ "Code": "HHWPZ6289106401YQ", "chargeweight": "0.523" }]
}
```

**字段提取规则：**
- `weight_g = Math.round(parseFloat(chargeweight) * 1000)`
- API 返回单位为 KG，数据库存储单位为 g

#### 2.3 数值精度规则

所有费用字段写入数据库前必须四舍五入到两位小数：
```javascript
Math.round(value * 100) / 100
```

#### 2.4 API 调用限流

- 每 5 次 API 调用后暂停 1 秒（`sleep(1000)`）
- getOrderFee 和 getBillingWeight 并行调用，计为 2 次

---

### Step 3：写入 freight 表

#### 3.1 写入策略：Upsert

1. 先批量查询 freight 表中已存在的运单号
2. 不存在的 → `INSERT`（新增）
3. 已存在的 → `UPSERT`（更新，`onConflict: 'tracking_no'`）
4. 分批执行，每批 100 条（`CHUNK = 100`），避免 URL 长度限制

#### 3.2 写入数据格式

```javascript
{
  tracking_no: "HHWPZ6289106401YQ",
  billing_date: "2026-10-18",
  weight_g: 523,
  freight: 109.93,
  freight_fee: 77.93,
  registered_fee: 32.00,
  other_fee: 0
}
```

---

### Step 4：数据校验

#### 4.1 校验规则

| 校验项 | 规则 | 失败标记 |
|--------|------|----------|
| 费用合计一致性 | `freight_fee + registered_fee + other_fee = freight`（允许 ±0.01 误差） | FAIL |
| 重量非空 | `weight_g IS NOT NULL AND weight_g > 0` | WARN |
| 结算日期非空 | `billing_date IS NOT NULL` | WARN |
| 总运费非负 | `freight >= 0` | WARN |
| freight 与 API 一致 | 数据库 freight 值 = API 返回 total_price | FAIL |

#### 4.2 校验 SQL

```sql
SELECT
  tracking_no,
  freight,
  freight_fee,
  registered_fee,
  other_fee,
  ROUND(freight_fee + registered_fee + other_fee, 2) AS calc_total,
  CASE
    WHEN ABS(ROUND(freight_fee + registered_fee + other_fee, 2) - freight) <= 0.01
    THEN 'PASS'
    ELSE 'FAIL'
  END AS total_check,
  CASE WHEN weight_g IS NULL OR weight_g <= 0 THEN 'WARN' ELSE 'PASS' END AS weight_check,
  CASE WHEN billing_date IS NULL THEN 'WARN' ELSE 'PASS' END AS date_check
FROM freight
WHERE tracking_no IN (/* 本次导入的运单号列表 */)
```

---

## 四、异常处理策略

### 4.1 API 异常分类

| 异常类型 | 表现 | 处理策略 |
|----------|------|----------|
| 运单不存在 | `ask != "Success"` 或 `message` 含 "not found" | 跳过，记录到异常报告 |
| 费用未出 | getOrderFee 返回空 details | 跳过，记录到异常报告（可能尚未出账） |
| 重量为空 | getBillingWeight 返回 chargeweight 为空 | 写入 freight 时 weight_g 设为 null，标记 WARN |
| 网络超时 | fetch 抛出异常 | 重试 1 次，仍失败则记录到异常报告 |
| API 限流 | 返回 HTTP 429 或类似错误 | 暂停 5 秒后重试 |
| 认证失败 | `ask = "Fail"` 且 message 含 "auth" | 终止工作流，检查 API 凭据 |

### 4.2 数据库异常分类

| 异常类型 | 表现 | 处理策略 |
|----------|------|----------|
| 唯一键冲突 | upsert 时 tracking_no 重复 | 正常覆盖更新 |
| 连接超时 | Supabase 连接失败 | 重试 3 次，间隔 5 秒 |
| 字段类型错误 | 写入非数值到 numeric 字段 | 记录异常，跳过该条 |

---

## 五、异常报告

### 5.1 控制台输出格式

工作流执行完毕后输出汇总报告：

```
========== Result ==========
Total:    90
Inserted: 85
Updated:  3
Failed:   2
API err:  2

Failed tracking numbers:
  HHWPZ6289XXXXX01YQ: getOrderFee returned not found
  HHWPZ6289XXXXX02YQ: Network timeout after retry
```

### 5.2 异常报告字段

| 字段 | 说明 |
|------|------|
| tracking_no | 运单号 |
| error_type | 异常类型（API_ERROR / DB_ERROR / VALIDATION_FAIL） |
| error_message | 异常详情 |
| api_response | API 原始返回（仅 API_ERROR） |

---

## 六、API 认证信息

| 项目 | 值 |
|------|-----|
| API 地址 | `http://api.hh-exp.com/default/svc/web-service` |
| 协议 | SOAP XML（callService 封装） |
| APP_TOKEN | 从环境变量或配置文件读取 |
| APP_KEY | 从环境变量或配置文件读取 |
| 认证方式 | MD5(APP_KEY + Timestamp) 签名 |

---

## 七、执行方式

### 7.1 批量导入（自动）

```bash
cd customer_portal/source
node ../tools/_hh_freight_batch_upsert.js
```

脚本自动执行 Step 1 → Step 2 → Step 3，输出 Step 4 校验结果。

### 7.2 单运单测试（手动）

使用 node-repl 或 curl 测试单个运单：

```javascript
// node-repl 中执行
const feeData = await callHh('getOrderFee', { reference_no: 'HHWPZ6289106401YQ' });
const weightData = await callHh('getBillingWeight', { codes: ['HHWPZ6289106401YQ'] });
console.log('Fee:', JSON.stringify(feeData, null, 2));
console.log('Weight:', JSON.stringify(weightData, null, 2));
```

---

## 八、已知陷阱与注意事项

1. **同类型费用多条求和**：华翰 API 可能对同一运单返回多条"速递运费"或"挂号费"（费用调整/退款），必须用 `+=` 求和，不能用 `=` 覆盖
2. **浮点精度**：JavaScript 浮点运算可能产生如 `38.989999999999995` 的结果，写入数据库前必须 `Math.round(x * 100) / 100`
3. **重量单位转换**：API 返回 KG，数据库存储 g，需要 × 1000
4. **billing_date 取值**：取 details 数组中第一条记录的 create_date，只取日期部分
5. **other_fee 为计算值**：API 不直接返回 other_fee，需要通过 `total - freight_fee - registered_fee` 计算
6. **Supabase 分页限制**：单次查询最多返回 1000 条，order_shipment 查询需分页
7. **API 限流**：每 5 次调用暂停 1 秒，避免触发华翰 API 限流
8. **负值费用**：费用调整可能产生负值的速递运费或挂号费，这是正常现象，求和后 total 仍为正
