# Order Billing 重构 - 快速参考

## 📌 核心概念

### 字段映射
```
orders.cog_usd         → order_billing.cog_billed_usd
orders.shipping_usd    → order_billing.freight_billed_usd  
orders.fulfillment_usd → order_billing.fulfillment_usd
orders.billing_date    → order_billing.billing_date
orders.ex_rate_used    → order_billing.ex_rate_used
orders.total_cost_usd  → (计算字段，不存储)
```

### 新增字段
- `cog_cny` - COG 人民币金额
- `cog_premium_cny` - COG 溢价
- `freight_est_cny` - 估算运费人民币
- `bill_issued` - 是否已出账（boolean，手动设置）

---

## 🔢 显示逻辑

### bill_issued = true（已出账）
```typescript
cog_usd = cog_billed_usd
shipping_usd = freight_billed_usd
fulfillment_usd = fulfillment_usd
total_cost_usd = order_billing.total_cost_usd  // 直接使用存储的总成本
```

### bill_issued = false（未出账，显示估算）
```typescript
// 汇率优先级：ex_rate_used > default (6.75)
effective_ex_rate = COALESCE(ex_rate_used, 6.75)

cog_usd = (cog_cny + cog_premium_cny) / effective_ex_rate
shipping_usd = freight_est_cny / effective_ex_rate
fulfillment_usd = fulfillment_usd
total_cost_usd = cog_usd + shipping_usd + fulfillment_usd
```

**默认汇率机制**：
- 优先使用 `ex_rate_used`（账单汇率）
- 然后使用配置表 `system_config.default_exchange_rate`（初始 6.75）
- 最后使用函数 `get_default_exchange_rate()` 计算的历史平均值（基于 ex_rate_used）
- 兜底值：6.75
- ❌ **不使用** `order_ex_rate`（可能不是美元汇率）

---

## 🗄️ 数据库对象

### 表：order_billing
```sql
CREATE TABLE order_billing (
  transaction_id TEXT PRIMARY KEY,
  cog_cny NUMERIC(12,2),
  cog_premium_cny NUMERIC(12,2) DEFAULT 0,
  freight_est_cny NUMERIC(12,2),
  cog_billed_usd NUMERIC(10,2),
  freight_billed_usd NUMERIC(10,2),
  fulfillment_usd NUMERIC(10,2),
  ex_rate_used NUMERIC(10,4),
  billing_date DATE,
  bill_issued BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### View：orders_with_billing_display
自动根据 `bill_issued` 返回正确的显示值。

**使用方式**：
```typescript
// 代替原来的 orders 表查询
supabase.from('orders_with_billing_display').select('*')
```

---

## 🔧 辅助函数

### 更新单个订单的 bill_issued
```sql
SELECT update_bill_issued_status('txn_123', true);
```

### 批量更新
```sql
SELECT batch_update_bill_issued(ARRAY['txn_1', 'txn_2'], true);
```

---

## 📝 代码修改要点

### 1. 类型定义（lib/types.ts）
```typescript
export interface OrderBilling {
  transaction_id: string
  cog_cny: number | null
  cog_premium_cny: number | null
  freight_est_cny: number | null
  cog_billed_usd: number | null
  freight_billed_usd: number | null
  fulfillment_usd: number | null
  ex_rate_used: number | null
  billing_date: string | null
  bill_issued: boolean
}

export interface Order {
  // ... 其他字段
  billing_date: string | null
  cog_usd: number | null          // 来自 view（billed 或 estimated）
  shipping_usd: number | null     // 来自 view
  fulfillment_usd: number | null
  total_cost_usd: number | null   // 来自 view
  ex_rate_used: number | null
  bill_issued: boolean | null
}
```

### 2. 查询修改
```typescript
// 之前
.from('orders')
.select('..., cog_usd, shipping_usd, ...')

// 之后
.from('orders_with_billing_display')
.select('..., cog_usd, shipping_usd, ..., bill_issued')
```

### 3. UI 添加 Toggle 按钮
```typescript
<button onClick={() => toggleBillIssued(txnId, currentStatus)}>
  {bill_issued ? '✓ Billed' : 'Mark as Billed'}
</button>
```

---

## ✅ 验证清单

### 迁移后验证
```sql
-- 检查记录数
SELECT COUNT(*) FROM order_billing;  -- 应为 472
SELECT COUNT(*) WHERE bill_issued = true;   -- 应为 63
SELECT COUNT(*) WHERE bill_issued = false;  -- 应为 409

-- 测试 view
SELECT * FROM orders_with_billing_display LIMIT 5;

-- 检查 billed 订单
SELECT ob.transaction_id, ob.cog_billed_usd, ob.freight_billed_usd
FROM order_billing ob
WHERE ob.bill_issued = true
LIMIT 3;

-- 检查 estimated 订单
SELECT ob.transaction_id, 
       ROUND((ob.cog_cny + ob.cog_premium_cny) / ob.ex_rate_used, 2) as est_cog
FROM order_billing ob
WHERE ob.bill_issued = false
LIMIT 3;
```

---

## 🚀 实施步骤速查

1. **执行迁移脚本** → `database-migrations/001_create_order_billing_table.sql`
2. **更新 TypeScript 类型** → `lib/types.ts`
3. **更新查询代码** → 所有 `.from('orders')` 改为 `.from('orders_with_billing_display')`
4. **添加 Toggle UI** → Billing 页面添加 bill_issued 切换按钮
5. **全面测试** → 验证所有功能正常
6. **清理旧字段** → （1-2 周后）删除 orders 表的旧列

---

## ⚠️ 常见问题

**Q: 为什么使用 View 而不是直接 JOIN？**  
A: View 封装了复杂的 CASE 逻辑，前端代码无需修改，保持简洁。

**Q: bill_issued 什么时候设置为 true？**  
A: 手动设置。当确认账单已发出时，在 Admin Billing 页面点击按钮标记。

**Q: 如果 ex_rate_used 为 NULL 怎么办？**  
A: View 会自动使用回退机制：
   1. 优先使用 `ex_rate_used`
   2. 然后使用配置表中的默认值（6.75）
   3. 最后使用历史平均值（基于 ex_rate_used）
   ❌ **不使用** `order_ex_rate`，因为它可能不是美元汇率

**Q: 如何修改默认汇率？**  
A: 更新 system_config 表：
```sql
UPDATE system_config 
SET config_value = '6.80', updated_at = NOW()
WHERE config_key = 'default_exchange_rate';
```

**Q: 性能会受影响吗？**  
A: 已添加索引，View 性能应该可接受。如遇到问题可考虑 Materialized View。

**Q: 可以回滚吗？**  
A: 可以。备份表 `orders_backup_20260810` 保留原始数据。

---

## 📞 快速命令

```bash
# 检查数据分布
node check-billing-data.js

# 执行迁移（通过 psql）
psql -h db.xxx.supabase.co -U postgres -d postgres -f database-migrations/001_create_order_billing_table.sql

# 验证迁移
psql -h db.xxx.supabase.co -U postgres -d postgres -c "SELECT COUNT(*) FROM order_billing;"
```

---

## 📚 相关文档

- 详细分析：`docs/order-billing-refactor-analysis.md`
- 实施指南：`docs/order-billing-implementation-guide.md`
- 迁移脚本：`database-migrations/001_create_order_billing_table.sql`

---

**最后更新**: 2026-08-10
