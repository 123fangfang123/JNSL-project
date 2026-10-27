# orders_with_billing_display View 计算逻辑详解

## 📋 View 概述

`orders_with_billing_display` 是一个智能视图，它根据订单的账单状态（`bill_issued`）自动选择显示**实际账单价格**或**估算价格**。

### 核心设计理念

```
┌─────────────────────────────────────┐
│   bill_issued = true (已出账)       │
│   ↓                                 │
│   显示实际的 billed USD 价格        │
│   - cog_billed_usd                  │
│   - freight_billed_usd              │
│   - fulfillment_usd                 │
└─────────────────────────────────────┘
              OR
┌─────────────────────────────────────┐
│   bill_issued = false (未出账)      │
│   ↓                                 │
│   显示估算的 USD 价格               │
│   - (cog_cny + premium) / rate      │
│   - freight_est_cny / rate          │
│   - fulfillment_usd                 │
└─────────────────────────────────────┘
```

---

## 🔢 汇率回退机制

在计算估算价格时，需要用到汇率。View 使用 **4 层回退机制**来获取汇率：

```sql
effective_ex_rate = COALESCE(
    ob.ex_rate_used,                                    -- 1. 账单汇率（最准确）
    (SELECT config_value FROM system_config ...),      -- 2. 配置表默认值 (6.75)
    get_default_exchange_rate(),                        -- 3. 历史平均值 (~6.7636)
    6.75                                                -- 4. 硬编码兜底值
)
```

### 回退层级说明

| 优先级 | 来源 | 说明 | 准确性 |
|--------|------|------|--------|
| 1 | `ob.ex_rate_used` | 账单中实际使用的汇率 | ⭐⭐⭐⭐⭐ 最准确 |
| 2 | `system_config.default_exchange_rate` | 手动配置的默认汇率 | ⭐⭐⭐⭐ 可调整 |
| 3 | `get_default_exchange_rate()` | 历史账单汇率平均值 | ⭐⭐⭐ 动态计算 |
| 4 | `6.75` | 硬编码兜底值 | ⭐⭐ 最后保障 |

**重要**：❌ **不使用** `orders.order_ex_rate`，因为它可能不是美元汇率。

---

## 💰 价格计算逻辑

### 1. COG USD（商品成本美元）

```sql
CASE 
    -- 情况 A: 已出账，直接使用 billed 价格
    WHEN ob.bill_issued = true THEN ob.cog_billed_usd
    
    -- 情况 B: 未出账，从 CNY 换算为 USD
    WHEN ob.cog_cny IS NOT NULL AND (有可用汇率) THEN
        ROUND(
            (ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / effective_ex_rate,
            2
        )
    
    -- 情况 C: 无法计算
    ELSE NULL
END as cog_usd
```

#### 计算公式

**已出账**：
```
cog_usd = cog_billed_usd
```

**未出账**：
```
cog_usd = (cog_cny + cog_premium_cny) / effective_ex_rate
```

#### 示例

假设某订单：
- `cog_cny = 1000` (人民币)
- `cog_premium_cny = 50` (溢价)
- `ex_rate_used = NULL` (没有账单汇率)
- `default_exchange_rate = 6.75` (配置表)

计算过程：
```
effective_ex_rate = 6.75  (使用配置表默认值)
cog_usd = (1000 + 50) / 6.75 = 155.56
```

---

### 2. Shipping USD（运费美元）

```sql
CASE 
    -- 情况 A: 已出账，直接使用 billed 价格
    WHEN ob.bill_issued = true THEN ob.freight_billed_usd
    
    -- 情况 B: 未出账，从估算运费 CNY 换算为 USD
    WHEN ob.freight_est_cny IS NOT NULL AND (有可用汇率) THEN
        ROUND(
            ob.freight_est_cny / effective_ex_rate,
            2
        )
    
    -- 情况 C: 无法计算
    ELSE NULL
END as shipping_usd
```

#### 计算公式

**已出账**：
```
shipping_usd = freight_billed_usd
```

**未出账**：
```
shipping_usd = freight_est_cny / effective_ex_rate
```

#### 示例

假设某订单：
- `freight_est_cny = 300` (估算运费人民币)
- `ex_rate_used = 6.76` (有账单汇率)

计算过程：
```
effective_ex_rate = 6.76  (使用账单汇率)
shipping_usd = 300 / 6.76 = 44.38
```

---

### 3. Fulfillment USD（履约费用美元）

```sql
ob.fulfillment_usd  -- 始终相同，不区分 billed/estimated
```

**说明**：Fulfillment 费用始终以 USD 存储，不需要汇率转换。

---

### 4. Total Cost USD（总成本美元）

```sql
CASE 
    -- 情况 A: 已出账，直接使用存储的总成本
    WHEN ob.bill_issued = true THEN 
        ob.total_cost_usd
    
    -- 情况 B: 未出账，分别计算后相加
    WHEN ob.cog_cny IS NOT NULL AND (有可用汇率) THEN
        ROUND(
            -- COG USD
            ((ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / effective_ex_rate) +
            
            -- Shipping USD
            (CASE 
                WHEN ob.freight_est_cny IS NOT NULL THEN 
                    ob.freight_est_cny / effective_ex_rate
                ELSE 0 
            END) +
            
            -- Fulfillment USD
            COALESCE(ob.fulfillment_usd, 0),
            
            2  -- 保留两位小数
        )
    
    -- 情况 C: 无法计算
    ELSE NULL
END as total_cost_usd
```

#### 计算公式

**已出账**：
```
total_cost_usd = order_billing.total_cost_usd  （账单环节计算并存储）
```

**未出账**：
```
total_cost_usd = cog_usd + shipping_usd + fulfillment_usd
```

其中：
- `cog_usd = (cog_cny + cog_premium_cny) / effective_ex_rate`
- `shipping_usd = freight_est_cny / effective_ex_rate`（如果有的话）

#### 完整示例

假设某订单（未出账）：
- `cog_cny = 1000`
- `cog_premium_cny = 50`
- `freight_est_cny = 300`
- `fulfillment_usd = 20`
- `ex_rate_used = NULL`
- `default_exchange_rate = 6.75`

计算过程：
```
effective_ex_rate = 6.75

cog_usd = (1000 + 50) / 6.75 = 155.56
shipping_usd = 300 / 6.75 = 44.44
fulfillment_usd = 20

total_cost_usd = 155.56 + 44.44 + 20 = 220.00
```

---

## 🎯 业务场景示例

### 场景 1: 新订单（未出账）

**数据**：
```json
{
  "transaction_id": "TXN001",
  "bill_issued": false,
  "cog_cny": 800,
  "cog_premium_cny": 0,
  "freight_est_cny": 250,
  "fulfillment_usd": 15,
  "ex_rate_used": null
}
```

**计算**：
```
effective_ex_rate = 6.75  (使用配置表默认值)

cog_usd = 800 / 6.75 = 118.52
shipping_usd = 250 / 6.75 = 37.04
fulfillment_usd = 15
total_cost_usd = 118.52 + 37.04 + 15 = 170.56
```

**View 输出**：
```json
{
  "transaction_id": "TXN001",
  "bill_issued": false,
  "cog_usd": 118.52,
  "shipping_usd": 37.04,
  "fulfillment_usd": 15,
  "total_cost_usd": 170.56,
  "effective_ex_rate": 6.75
}
```

---

### 场景 2: 已出账订单

**数据**：
```json
{
  "transaction_id": "TXN002",
  "bill_issued": true,
  "cog_billed_usd": 120.50,
  "freight_billed_usd": 38.20,
  "fulfillment_usd": 15,
  "ex_rate_used": 6.76,
  "billing_date": "2026-08-01"
}
```

**计算**：
```
effective_ex_rate = 6.76  (使用账单汇率)

cog_usd = 120.50  (直接使用 billed 值)
shipping_usd = 38.20  (直接使用 billed 值)
fulfillment_usd = 15
total_cost_usd = 120.50 + 38.20 + 15 = 173.70
```

**View 输出**：
```json
{
  "transaction_id": "TXN002",
  "bill_issued": true,
  "cog_usd": 120.50,
  "shipping_usd": 38.20,
  "fulfillment_usd": 15,
  "total_cost_usd": 173.70,
  "effective_ex_rate": 6.76,
  "billing_date": "2026-08-01"
}
```

---

### 场景 3: 部分数据缺失

**数据**：
```json
{
  "transaction_id": "TXN003",
  "bill_issued": false,
  "cog_cny": 900,
  "cog_premium_cny": 0,
  "freight_est_cny": null,  // 没有估算运费
  "fulfillment_usd": null,  // 没有 fulfillment
  "ex_rate_used": null
}
```

**计算**：
```
effective_ex_rate = 6.75

cog_usd = 900 / 6.75 = 133.33
shipping_usd = NULL  (因为 freight_est_cny 为 NULL)
fulfillment_usd = NULL
total_cost_usd = 133.33 + 0 + 0 = 133.33
```

**View 输出**：
```json
{
  "transaction_id": "TXN003",
  "bill_issued": false,
  "cog_usd": 133.33,
  "shipping_usd": null,
  "fulfillment_usd": null,
  "total_cost_usd": 133.33,
  "effective_ex_rate": 6.75
}
```

---

## 🔍 关键设计决策

### 1. 为什么使用 View 而不是直接查询？

**优势**：
- ✅ 封装复杂的 CASE 逻辑
- ✅ 前端代码无需关心 billed/estimated 的区别
- ✅ 集中维护业务规则
- ✅ 保证数据一致性

**对比**：
```typescript
// ❌ 不使用 View：前端需要处理复杂逻辑
const cogUsd = order.bill_issued 
  ? order.cog_billed_usd 
  : (order.cog_cny + order.cog_premium_cny) / getExchangeRate(order);

// ✅ 使用 View：前端直接使用
const cogUsd = order.cog_usd;  // View 已经计算好了
```

### 2. 为什么需要 4 层汇率回退？

**原因**：
- 只有 13.3% 的订单有 `ex_rate_used`
- 其他 86.7% 的订单需要使用默认汇率
- 多层回退确保总能获得一个合理的汇率值

**好处**：
- 灵活性：可以通过配置表调整默认汇率
- 准确性：优先使用实际账单汇率
- 健壮性：即使配置表为空也能工作

### 3. 为什么不使用 `order_ex_rate`？

**原因**：
- `order_ex_rate` 可能不是 USD/CNY 汇率
- 可能是其他货币的汇率（如 EUR/CNY、GBP/CNY 等）
- 用它来计算 USD 价格会导致错误

**正确做法**：
- 只使用 `ex_rate_used`（账单汇率，确定是 USD/CNY）
- 或使用配置的默认汇率

---

## 📊 View 列清单

View 共返回 **20 列**：

| # | 列名 | 来源 | 说明 |
|---|------|------|------|
| 1 | `transaction_id` | orders | 交易 ID |
| 2 | `order_number` | orders | 订单号 |
| 3 | `store_name` | orders | 店铺名称 |
| 4 | `order_date` | orders | 订单日期 |
| 5 | `dispatch_date` | orders | 发货日期 |
| 6 | `order_status` | orders | 订单状态 |
| 7 | `country` | orders | 国家 |
| 8 | `abnormal_code` | orders | 异常代码 |
| 9 | `remarks` | orders | 备注 |
| 10 | `is_abnormal` | orders | 是否异常 |
| 11 | `order_cny_value` | orders | 订单人民币金额 |
| 12 | `order_ex_rate` | orders | 订单汇率（仅供参考，不用于计算） |
| 13 | `billing_date` | order_billing | 账单日期 |
| 14 | `bill_issued` | order_billing | 是否已出账 |
| 15 | `ex_rate_used` | order_billing | 账单汇率 |
| 16 | `effective_ex_rate` | **计算** | 实际使用的汇率（4层回退） |
| 17 | `cog_usd` | **计算** | COG 美元（billed 或 estimated） |
| 18 | `shipping_usd` | **计算** | 运费美元（billed 或 estimated） |
| 19 | `fulfillment_usd` | order_billing | 履约费用美元 |
| 20 | `total_cost_usd` | **计算** | 总成本美元 |

---

## 🧪 测试用例

### 测试 1: 验证汇率回退

```sql
-- 检查不同订单使用的汇率来源
SELECT 
    transaction_id,
    bill_issued,
    ex_rate_used,
    effective_ex_rate,
    CASE 
        WHEN ex_rate_used IS NOT NULL THEN 'bill_rate'
        ELSE 'default_rate'
    END as rate_source
FROM orders_with_billing_display
LIMIT 10;
```

### 测试 2: 验证价格计算

```sql
-- 对比 billed 和 estimated 订单的价格
SELECT 
    bill_issued,
    COUNT(*) as count,
    ROUND(AVG(cog_usd), 2) as avg_cog_usd,
    ROUND(AVG(shipping_usd), 2) as avg_shipping_usd,
    ROUND(AVG(fulfillment_usd), 2) as avg_fulfillment_usd,
    ROUND(AVG(total_cost_usd), 2) as avg_total_usd
FROM orders_with_billing_display
GROUP BY bill_issued;
```

### 测试 3: 验证总额计算

```sql
-- 验证 total_cost_usd = cog_usd + shipping_usd + fulfillment_usd
SELECT 
    transaction_id,
    cog_usd,
    shipping_usd,
    fulfillment_usd,
    total_cost_usd,
    ROUND(COALESCE(cog_usd, 0) + COALESCE(shipping_usd, 0) + COALESCE(fulfillment_usd, 0), 2) as calculated_total,
    CASE 
        WHEN ABS(total_cost_usd - (COALESCE(cog_usd, 0) + COALESCE(shipping_usd, 0) + COALESCE(fulfillment_usd, 0))) < 0.01 
        THEN '✓ Match'
        ELSE '✗ Mismatch'
    END as validation
FROM orders_with_billing_display
WHERE total_cost_usd IS NOT NULL
LIMIT 20;
```

所有记录应该显示 "✓ Match"。

---

## 💡 最佳实践

### 1. 前端使用

```typescript
// ✅ 推荐：直接使用 View 返回的值
const orders = await supabase.from('orders_with_billing_display').select('*');

orders.forEach(order => {
  console.log(`COG: $${order.cog_usd}`);
  console.log(`Shipping: $${order.shipping_usd}`);
  console.log(`Total: $${order.total_cost_usd}`);
});
```

### 2. 更新 bill_issued 状态

```sql
-- 标记订单已出账
SELECT update_bill_issued_status('TXN001', true);

-- 批量标记
SELECT batch_update_bill_issued(
  ARRAY['TXN001', 'TXN002', 'TXN003'],
  true
);
```

### 3. 调整默认汇率

```sql
-- 查看当前默认汇率
SELECT * FROM system_config WHERE config_key = 'default_exchange_rate';

-- 更新默认汇率
UPDATE system_config 
SET config_value = '6.80', updated_at = NOW()
WHERE config_key = 'default_exchange_rate';
```

---

## ⚠️ 注意事项

1. **性能考虑**
   - View 包含多个子查询（获取配置表、调用函数）
   - 对于大数据量查询，考虑使用 Materialized View
   - 已添加索引优化性能

2. **NULL 处理**
   - 使用 `COALESCE` 处理 NULL 值
   - 某些字段可能为 NULL（如没有运费的订单）
   - 前端需要处理 NULL 情况

3. **精度问题**
   - 所有金额保留 2 位小数
   - 汇率保留 4 位小数
   - 使用 `ROUND()` 确保精度一致

4. **数据一致性**
   - View 实时计算，始终反映最新数据
   - 修改 `order_billing` 表后，View 自动更新
   - 无需手动刷新

---

**最后更新**: 2026-08-10  
**相关文档**: 
- [order-billing-implementation-guide.md](./order-billing-implementation-guide.md)
- [DEFAULT_EXCHANGE_RATE_MECHANISM.md](./DEFAULT_EXCHANGE_RATE_MECHANISM.md)
