# 燕文运费 API 批量导入工作流

> 版本：v1.0 | 创建日期：2026-10-22 | 物流商：YANWEN（燕文物流）

## 概述

本工作流从数据库 `order_shipment` 表中查询燕文运单号，调用燕文开放平台 `express.order.bill.getlist` 接口获取运费信息，将结果写入 `freight` 表，并执行数据校验和生成异常报告。

## 前置条件

- 燕文开放平台 API 权限（`express.order.bill.getlist` 需联系销售开通）
- 凭据文件：`customer_portal/燕文API KEY`（user_id + apitoken）
- Supabase 数据库连接（环境变量 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY）
- Node.js >= 18（需原生 fetch 支持）

## 脚本信息

- 位置：`customer_portal/tools/_yanwen_freight_batch_upsert.js`
- 执行：`cd customer_portal/tools && node _yanwen_freight_batch_upsert.js`
- 参数：
  - `--dry-run`：仅查询不写入数据库
  - `--days N`：自定义查询天数（默认 90，即最近 3 个月）
  - `--carrier YANWEN`：物流商名称（默认 YANWEN）
  - `--tracking ULxxxxx`：指定单个运单号查询（调试用）

---

## Step 1：查询待处理运单号

### 数据来源
- 表：`order_shipment`
- 查询条件：
  1. `carrier = 'YANWEN'`
  2. `process_date >= 当前日期 - 90天`（最近 3 个月）
  3. `dest_tracking IS NOT NULL`（已有尾程跟踪号的运单）
- 返回字段：`tracking_no`（运单号，即燕文 waybillNumber）

### 分页策略
- Supabase 单次查询上限 1000 条
- 使用 `offset + limit` 分页，循环读取直到无更多数据
- 收集所有 `tracking_no` 到数组

### 输出
- 打印查询到的运单总数
- 若为 0 则提前结束工作流

---

## Step 2：调用燕文 API 查询运费

### 接口信息
- 接口：`express.order.bill.getlist`（已出账单详情）
- 地址：`https://open.yw56.com.cn/api/order`
- 方式：POST（Content-Type: application/json）
- 认证：MD5 签名（apitoken + user_id + data + format + method + timestamp + version + apitoken）

### 签名算法
```
1. 按字典序拼接参数：user_id + data + format + method + timestamp + version
2. 头部和尾部拼接 apitoken：apitoken + 步骤1结果 + apitoken
3. MD5 加密（32位小写）
```

### 请求参数
```json
{
  "waybillNumbers": ["UL606876914YP", "UL606750896YP", ...]
}
```

### 批量策略
- 每批最多 **50** 个运单号（燕文 API 限制）
- 批次间隔 **200ms**（避免触发频率限制）

### 响应字段映射

| API 响应字段 | freight 表字段 | 转换规则 |
|---|---|---|
| `waybillNumber` | `tracking_no` | 直接使用 |
| `dateOfBill` | `billing_date` | 截取日期部分（YYYY-MM-DD） |
| `calcWeight` | `weight_g` | 转为整数（单位已是 g） |
| `arOriPrice` | `freight` | 转为浮点数（总运费） |
| — | `freight_fee` | **null**（燕文 API 不提供拆分） |
| — | `registered_fee` | **null**（燕文 API 不提供拆分） |
| — | `other_fee` | **null**（燕文 API 不提供拆分） |

### 重试机制
- API 调用失败时最多重试 **2 次**
- 重试间隔：第 1 次等 1 秒，第 2 次等 3 秒
- 重试后仍失败则记录到异常列表，继续处理下一批

### 未出账单处理
- API 返回 `success: true` 但 `data` 为空数组 → 该运单尚未出账单
- 未出账单的运单**不写入** freight 表，记录到跳过列表

---

## Step 3：写入 freight 表

### Upsert 策略
1. 先查询 freight 表中已存在的 `tracking_no`
2. 已存在的 → `PATCH` 更新（billing_date, weight_g, freight）
3. 不存在的 → `POST` 插入新记录

### 分块写入
- 插入操作按 **100 条**分块，避免单次请求过大
- 更新操作逐条执行（PATCH by tracking_no）

### 数据库写入重试
- 写入失败时最多重试 **3 次**
- 重试间隔：1 秒、2 秒、4 秒（指数退避）

---

## Step 4：数据校验

对 Step 3 写入的每条记录执行以下校验：

### 校验规则

| 校验项 | 规则 | 严重级别 |
|---|---|---|
| billing_date 非空 | `billing_date IS NOT NULL` | ERROR |
| weight_g 非空且为正 | `weight_g > 0` | ERROR |
| freight 非空且非负 | `freight IS NOT NULL AND freight >= 0` | ERROR |
| tracking_no 唯一 | freight 表中无重复 tracking_no | WARN |
| 总额一致性 | API 返回的 arOriPrice = DB 中的 freight | ERROR |

### 校验方式
- 从 freight 表反查刚写入的记录
- 与 API 返回的原始数据逐条比对
- 输出匹配率（match_rate = 通过校验数 / 总写入数 × 100%）

---

## Step 5：生成异常报告

### 报告格式
- 文件：`customer_portal/reports/yanwen_freight_report_YYYYMMDD_HHmmss.json`
- 结构：

```json
{
  "report_time": "2026-10-22T10:30:00",
  "carrier": "YANWEN",
  "process_date_from": "2026-07-22",
  "process_date_to": "2026-10-22",
  "summary": {
    "total_tracking_nos": 150,
    "api_success": 120,
    "api_no_billing": 28,
    "api_failed": 2,
    "inserted": 80,
    "updated": 40,
    "validation_pass_rate": "98.5%"
  },
  "no_billing_tracking_nos": ["UL606750896YP", ...],
  "api_errors": [
    { "tracking_no": "ULxxx", "error": "系统异常", "retries": 2 }
  ],
  "validation_failures": [
    { "tracking_no": "ULxxx", "field": "freight", "expected": 109.09, "actual": null }
  ]
}
```

### 报告字段说明
- `total_tracking_nos`：Step 1 查询到的运单总数
- `api_success`：API 成功返回运费数据的运单数
- `api_no_billing`：API 返回成功但无账单数据（未出账）的运单数
- `api_failed`：API 调用失败（含重试后仍失败）的运单数
- `inserted`：新插入 freight 表的记录数
- `updated`：更新 freight 表的记录数
- `validation_pass_rate`：数据校验通过率
- `no_billing_tracking_nos`：未出账单的运单号列表（后续可重新查询）
- `api_errors`：API 调用失败的运单号及错误信息
- `validation_failures`：校验不通过的记录详情

---

## 异常处理策略

### API 异常
| 异常类型 | 处理方式 |
|---|---|
| 签名错误 | 检查凭据文件，终止执行 |
| 权限不足 | 提示联系燕文销售开通，终止执行 |
| 系统异常 | 重试 2 次，仍失败则记录到异常报告 |
| 网络超时 | 重试 2 次，仍失败则记录到异常报告 |
| 返回空数据 | 正常情况（未出账），记录到跳过列表 |

### 数据库异常
| 异常类型 | 处理方式 |
|---|---|
| 连接失败 | 重试 3 次（指数退避），仍失败则终止 |
| 写入冲突 | 记录到异常报告，继续处理其他记录 |
| 查询超时 | 缩小分页 size，重试 |

### 数据校验异常
| 异常类型 | 处理方式 |
|---|---|
| freight 为负值 | 记录到异常报告，不阻断写入 |
| weight_g 为 0 | 记录到异常报告，标记为 WARN |
| 总额不一致 | 记录到异常报告，标记为 ERROR |

---

## 执行流程总结

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: 查询 order_shipment                                  │
│   carrier=YANWEN, process_date>=最近3个月, dest_tracking非空  │
│   → 得到 tracking_no 列表                                    │
├──────────────────────────────────────────────────────────────┤
│ Step 2: 调用燕文 API                                         │
│   express.order.bill.getlist（每批50个，间隔200ms）           │
│   → 得到运费数据 Map<tracking_no, freight_record>            │
│   → 未出账单的运单记录到跳过列表                              │
├──────────────────────────────────────────────────────────────┤
│ Step 3: Upsert freight 表                                    │
│   已存在 → PATCH 更新                                        │
│   不存在 → POST 插入（每批100条）                             │
├──────────────────────────────────────────────────────────────┤
│ Step 4: 数据校验                                             │
│   反查 DB 与 API 原始数据比对                                 │
│   → 输出匹配率                                               │
├──────────────────────────────────────────────────────────────┤
│ Step 5: 生成异常报告                                         │
│   → JSON 报告保存到 reports/ 目录                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 与华翰工作流的差异

| 对比项 | 华翰 (HH EXPRESS) | 燕文 (YANWEN) |
|---|---|---|
| API 数量 | 2 个（getOrderFee + getBillingWeight） | 1 个（express.order.bill.getlist） |
| 费用拆分 | ✅ 有（速递运费/挂号费/其他费） | ❌ 无（仅总价 arOriPrice） |
| 重量来源 | getBillingWeight.chargeweight (KG→g) | bill.getlist.calcWeight (已是 g) |
| 结算日期 | getOrderFee.details[0].create_date | bill.getlist.dateOfBill |
| 认证方式 | XML + APP_TOKEN/APP_KEY | JSON + MD5 签名 |
| 批量限制 | 逐单查询（5次/秒） | 每批 50 个运单号 |
| freight_fee | ✅ 可拆分 | ❌ null |
| registered_fee | ✅ 可拆分 | ❌ null |
| other_fee | ✅ 可计算 | ❌ null |

---

## 注意事项

1. **未出账单**：燕文 API 对未出账的运单返回空数组（不是报错），这是正常状态。工作流会记录这些运单号到异常报告中，后续可重新运行脚本查询。
2. **费用拆分缺失**：燕文 API 只提供总运费 `arOriPrice`，不提供 `freight_fee`/`registered_fee`/`other_fee` 三项拆分。如需拆分数据，仍需依赖燕文每月导出的 Excel 运费账单文件，通过 `/admin/upload/freight` 手动上传。
3. **幂等性**：脚本支持重复执行。对已存在于 freight 表的运单，会更新其费用信息而非重复插入。
4. **凭据安全**：燕文 API 凭据存储在 `customer_portal/燕文API KEY` 文件中，不要提交到版本控制。
