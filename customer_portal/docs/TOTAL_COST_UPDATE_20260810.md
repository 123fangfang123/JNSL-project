# Total Cost USD 显示逻辑更新

## 📅 更新日期
2026-08-10

## 🎯 变更目标

优化 `total_cost_usd` 字段的显示逻辑，已出账订单直接使用存储的总成本值，而不是重新计算。

---

## 🔄 变更前后对比

### 变更前 ❌

**已出账（bill_issued = true）**：
```sql
-- View 中动态计算
total_cost_usd = cog_billed_usd + freight_billed_usd + fulfillment_usd
```

**问题**：
- 每次查询都需要重新计算
- 如果 billed 字段被修改，View 会自动重新计算，可能与实际账单不一致
- 无法保留账单时的原始总额

### 变更后 ✅

**已出账（bill_issued = true）**：
```sql
-- 直接使用 order_billing.total_cost_usd 字段
total_cost_usd = order_billing.total_cost_usd
```

**优势**：
- ✅ 直接使用存储的值，性能更好
- ✅ 保留账单时的原始总额，不会因后续修改而改变
- ✅ 与账单系统保持一致

---

## 🛠️ 修改内容

### 1. 数据库表结构

在 `order_billing` 表中添加 `total_cost_usd` 字段：

```sql
CREATE TABLE IF NOT EXISTS order_billing (
    -- ... 其他字段
    cog_billed_usd NUMERIC(10,2),
    freight_billed_usd NUMERIC(10,2),
    fulfillment_usd NUMERIC(10,2),
    total_cost_usd NUMERIC(10,2),             -- ✅ 新增字段
    ex_rate_used NUMERIC(10,4),
    billing_date DATE,
    bill_issued BOOLEAN DEFAULT false,
    -- ... 审计字段
);

COMMENT ON COLUMN order_billing.total_cost_usd IS 
    '总成本美元（cog_billed_usd + freight_billed_usd + fulfillment_usd，账单后计算并存储）';
```

### 2. View 逻辑更新

**修改前**：
```sql
CASE 
    WHEN ob.bill_issued = true THEN 
        ob.cog_billed_usd + ob.freight_billed_usd + ob.fulfillment_usd  -- ❌ 动态计算
    -- ...
END as total_cost_usd
```

**修改后**：
```sql
CASE 
    WHEN ob.bill_issued = true THEN 
        ob.total_cost_usd  -- ✅ 直接使用存储值
    -- ...
END as total_cost_usd
```

### 3. 未出账逻辑保持不变

**未出账（bill_issued = false）**：
```sql
-- 仍然动态计算
total_cost_usd = cog_usd + shipping_usd + fulfillment_usd

-- 展开后
total_cost_usd = 
    (cog_cny + cog_premium_cny) / effective_ex_rate +
    freight_est_cny / effective_ex_rate +
    fulfillment_usd
```

---

## 📝 更新的文件

### 1. database-migrations/001_create_order_billing_table.sql

**修改内容**：
- ✅ 在 `order_billing` 表中添加 `total_cost_usd` 字段
- ✅ 添加字段注释说明
- ✅ 更新 View 逻辑使用 `ob.total_cost_usd`

### 2. docs/BILLING_VIEW_LOGIC_EXPLANATION.md

**修改内容**：
- ✅ 更新 Total Cost USD 计算公式说明
- ✅ 明确已出账时使用 `order_billing.total_cost_usd`

### 3. docs/order-billing-implementation-guide.md

**修改内容**：
- ✅ 更新已出账时的计算公式

### 4. docs/ORDER_BILLING_QUICK_REFERENCE.md

**修改内容**：
- ✅ 更新快速参考中的计算公式

---

## 💡 业务含义

### 账单流程

```
┌─────────────────────────────────────┐
│   1. 订单创建                        │
│      - bill_issued = false           │
│      - 只有 CNY 估算值               │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   2. 账单生成（Billing 环节）         │
│      - 设置 cog_billed_usd           │
│      - 设置 freight_billed_usd       │
│      - 设置 fulfillment_usd          │
│      - 计算 total_cost_usd           │  ← 关键步骤
│      - 设置 ex_rate_used             │
│      - 设置 billing_date             │
│      - 设置 bill_issued = true       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   3. 订单查询                        │
│      - View 直接返回                 │
│        total_cost_usd（存储值）       │
└─────────────────────────────────────┘
```

### Billing 环节的计算逻辑

在账单生成时，应该这样计算 `total_cost_usd`：

```typescript
// Billing 服务代码示例
async function generateBilling(transactionId: string) {
  const billing = await getBillingData(transactionId);
  
  // 计算总成本
  const totalCostUsd = 
    billing.cog_billed_usd + 
    billing.freight_billed_usd + 
    billing.fulfillment_usd;
  
  // 保存账单信息
  await updateOrderBilling({
    transaction_id: transactionId,
    cog_billed_usd: billing.cog_billed_usd,
    freight_billed_usd: billing.freight_billed_usd,
    fulfillment_usd: billing.fulfillment_usd,
    total_cost_usd: totalCostUsd,  // ✅ 存储计算结果
    ex_rate_used: billing.ex_rate_used,
    billing_date: new Date(),
    bill_issued: true,
  });
}
```

---

## ⚠️ 注意事项

### 1. 数据迁移

如果数据库中已有 `order_billing` 数据，需要执行以下 SQL 来填充 `total_cost_usd`：

```sql
UPDATE order_billing
SET total_cost_usd = cog_billed_usd + freight_billed_usd + fulfillment_usd
WHERE bill_issued = true 
  AND total_cost_usd IS NULL;
```

### 2. 账单生成时必须设置

在 Billing 环节生成账单时，**必须**同时设置 `total_cost_usd`：

```sql
INSERT INTO order_billing (
    transaction_id,
    cog_billed_usd,
    freight_billed_usd,
    fulfillment_usd,
    total_cost_usd,  -- ✅ 必须设置
    ex_rate_used,
    billing_date,
    bill_issued
) VALUES (
    'TXN001',
    100.00,
    20.00,
    5.00,
    125.00,  -- ✅ 100 + 20 + 5
    6.75,
    '2026-08-10',
    true
);
```

### 3. 账单修改时的同步

如果后续需要修改账单金额，**必须**同时更新 `total_cost_usd`：

```sql
UPDATE order_billing
SET 
    cog_billed_usd = 110.00,
    total_cost_usd = 110.00 + freight_billed_usd + fulfillment_usd  -- ✅ 重新计算
WHERE transaction_id = 'TXN001';
```

---

## ✅ 验证测试

### 测试 1：已出账订单

```sql
-- 插入测试数据
INSERT INTO order_billing (
    transaction_id,
    cog_billed_usd,
    freight_billed_usd,
    fulfillment_usd,
    total_cost_usd,
    ex_rate_used,
    billing_date,
    bill_issued
) VALUES (
    'TEST001',
    100.00,
    20.00,
    5.00,
    125.00,  -- 100 + 20 + 5
    6.75,
    '2026-08-10',
    true
);

-- 查询 View
SELECT 
    transaction_id,
    bill_issued,
    cog_usd,
    shipping_usd,
    fulfillment_usd,
    total_cost_usd
FROM orders_with_billing_display
WHERE transaction_id = 'TEST001';

-- 预期结果：
-- total_cost_usd = 125.00（直接使用存储值）
```

### 测试 2：未出账订单

```sql
-- 插入测试数据
INSERT INTO order_billing (
    transaction_id,
    cog_cny,
    cog_premium_cny,
    freight_est_cny,
    fulfillment_usd,
    ex_rate_used,
    bill_issued
) VALUES (
    'TEST002',
    675.00,
    0,
    135.00,
    5.00,
    6.75,
    false
);

-- 查询 View
SELECT 
    transaction_id,
    bill_issued,
    cog_usd,
    shipping_usd,
    fulfillment_usd,
    total_cost_usd
FROM orders_with_billing_display
WHERE transaction_id = 'TEST002';

-- 预期结果：
-- cog_usd = 675 / 6.75 = 100.00
-- shipping_usd = 135 / 6.75 = 20.00
-- fulfillment_usd = 5.00
-- total_cost_usd = 100 + 20 + 5 = 125.00（动态计算）
```

---

## 📊 总结

| 项目 | 变更前 | 变更后 |
|------|--------|--------|
| **已出账计算方式** | 动态计算三项之和 | 直接使用存储值 |
| **性能** | 每次查询都计算 | 直接读取，更快 |
| **数据一致性** | 可能随 billed 字段变化 | 保持账单原始值 |
| **存储需求** | 无需额外字段 | 需要 total_cost_usd 字段 |
| **Billing 复杂度** | 简单 | 需要计算并存储总额 |

**核心优势**：
- ✅ 更好的性能（避免重复计算）
- ✅ 更强的数据一致性（保留账单原始值）
- ✅ 更清晰的业务语义（区分"账单总额"和"估算总额"）
