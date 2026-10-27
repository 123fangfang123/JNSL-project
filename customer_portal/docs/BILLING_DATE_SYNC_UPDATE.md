# Billing Date 同步逻辑更新

## 📅 更新日期
2026-08-10

## 🎯 变更目标

确保 `billing_date` 字段**仅在** `bill_issued = true` 时同步到 `orders` 表。

---

## 🔄 同步规则

### billing_date 字段的同步条件

```sql
billing_date = CASE 
    WHEN NEW.bill_issued = true THEN NEW.billing_date  -- ✅ 已出账，同步账单日期
    ELSE NULL                                             -- ❌ 未出账，清空账单日期
END
```

### 完整同步逻辑

| order_billing 字段 | orders 表字段 | 同步条件 |
|-------------------|--------------|---------|
| cog_billed_usd / 计算值 | cog_usd | 总是同步 |
| freight_billed_usd / 计算值 | shipping_usd | 总是同步 |
| fulfillment_usd | fulfillment_usd | 总是同步 |
| **billing_date** | **billing_date** | **仅当 bill_issued = true** |
| total_cost_usd / 计算值 | total_cost_usd | 总是同步 |

---

## 💡 业务逻辑

### 场景 1: 订单出账（bill_issued: false → true）

```sql
-- 管理员确认账单
UPDATE order_billing
SET 
    bill_issued = true,
    billing_date = '2026-08-10',
    cog_billed_usd = 100.00,
    freight_billed_usd = 20.00,
    total_cost_usd = 125.00
WHERE transaction_id = 'TXN001';

-- 触发器自动执行
-- orders 表同步结果：
-- billing_date = '2026-08-10'  ← ✅ 设置账单日期
-- cog_usd = 100.00
-- shipping_usd = 20.00
-- total_cost_usd = 125.00
```

### 场景 2: 取消出账（bill_issued: true → false）

```sql
-- 管理员取消账单
UPDATE order_billing
SET 
    bill_issued = false,
    billing_date = NULL  -- 清空账单日期
WHERE transaction_id = 'TXN001';

-- 触发器自动执行
-- orders 表同步结果：
-- billing_date = NULL  ← ✅ 清空账单日期
-- cog_usd = (重新计算估算值)
-- shipping_usd = (重新计算估算值)
-- total_cost_usd = (重新计算估算值)
```

### 场景 3: 修改已出账订单的账单日期

```sql
-- 管理员修改账单日期
UPDATE order_billing
SET 
    billing_date = '2026-08-15'  -- 修改日期
WHERE transaction_id = 'TXN001';

-- 触发器自动执行
-- orders 表同步结果：
-- billing_date = '2026-08-15'  ← ✅ 更新日期
```

---

## 🛠️ 实施细节

### 1. 添加 billing_date 字段到 orders 表

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_date DATE;
COMMENT ON COLUMN orders.billing_date IS '账单日期（仅在 bill_issued = true 时同步）';
```

### 2. 更新触发器函数

```sql
CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders o
    SET 
        -- ... 其他字段 ...
        
        -- Billing Date: Only sync when bill_issued = true
        billing_date = CASE 
            WHEN NEW.bill_issued = true THEN NEW.billing_date
            ELSE NULL  -- Clear billing_date if bill_issued becomes false
        END,
        
        -- ... 其他字段 ...
    WHERE o.transaction_id = NEW.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ 验证测试

### 测试 1: 出账时同步 billing_date

```sql
-- 插入已出账记录
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
    'TEST_BILLING_DATE_001',
    100.00,
    20.00,
    5.00,
    125.00,
    6.75,
    '2026-08-10',
    true
);

-- 检查 orders 表
SELECT 
    transaction_id,
    billing_date,
    cog_usd,
    total_cost_usd
FROM orders
WHERE transaction_id = 'TEST_BILLING_DATE_001';

-- 预期结果：
-- billing_date = '2026-08-10' ✅
```

### 测试 2: 未出账时 billing_date 为 NULL

```sql
-- 插入未出账记录
INSERT INTO order_billing (
    transaction_id,
    cog_cny,
    freight_est_cny,
    fulfillment_usd,
    ex_rate_used,
    bill_issued
) VALUES (
    'TEST_BILLING_DATE_002',
    675.00,
    135.00,
    5.00,
    6.75,
    false
);

-- 检查 orders 表
SELECT 
    transaction_id,
    billing_date,
    cog_usd,
    total_cost_usd
FROM orders
WHERE transaction_id = 'TEST_BILLING_DATE_002';

-- 预期结果：
-- billing_date = NULL ✅
```

### 测试 3: 取消出账时清空 billing_date

```sql
-- 先设置为已出账
UPDATE order_billing
SET 
    bill_issued = true,
    billing_date = '2026-08-10'
WHERE transaction_id = 'TEST_BILLING_DATE_003';

-- 验证 billing_date 已设置
SELECT billing_date FROM orders WHERE transaction_id = 'TEST_BILLING_DATE_003';
-- 预期：'2026-08-10'

-- 取消出账
UPDATE order_billing
SET 
    bill_issued = false,
    billing_date = NULL
WHERE transaction_id = 'TEST_BILLING_DATE_003';

-- 验证 billing_date 已清空
SELECT billing_date FROM orders WHERE transaction_id = 'TEST_BILLING_DATE_003';
-- 预期：NULL ✅
```

### 测试 4: 修改账单日期

```sql
-- 修改账单日期
UPDATE order_billing
SET billing_date = '2026-08-15'
WHERE transaction_id = 'TEST_BILLING_DATE_001';

-- 验证 orders 表已更新
SELECT billing_date FROM orders WHERE transaction_id = 'TEST_BILLING_DATE_001';
-- 预期：'2026-08-15' ✅
```

---

## 📊 数据流图

```
order_billing 表
    ↓
    ├─ bill_issued = true
    │   └─ billing_date = '2026-08-10'
    │       ↓ 触发器
    │       orders.billing_date = '2026-08-10' ✅
    │
    └─ bill_issued = false
        └─ billing_date = NULL
            ↓ 触发器
            orders.billing_date = NULL ✅
```

---

## 🔍 前端使用示例

### 显示账单状态

```tsx
// components/OrderRow.tsx
export function OrderRow({ order }: { order: Order }) {
  const isBilled = order.billing_date !== null;
  
  return (
    <tr>
      <td>{order.order_number}</td>
      <td className="text-right">
        ${order.cog_usd?.toFixed(2) ?? '—'}
      </td>
      <td className="text-right">
        ${order.shipping_usd?.toFixed(2) ?? '—'}
      </td>
      <td className="text-right">
        ${order.fulfillment_usd?.toFixed(2) ?? '—'}
      </td>
      <td className="text-right font-bold">
        ${order.total_cost_usd?.toFixed(2) ?? '—'}
      </td>
      <td className="text-center">
        {isBilled ? (
          <span className="text-green-600 text-xs">
            Billed on {order.billing_date}
          </span>
        ) : (
          <span className="text-amber-600 text-xs">
            Bill Pending
          </span>
        )}
      </td>
    </tr>
  );
}
```

### 筛选已出账订单

```typescript
// 查询已出账的订单
const { data: billedOrders } = await supabase
  .from('orders')
  .select('*')
  .not('billing_date', 'is', null)  // 只返回已出账的订单
  .gte('billing_date', '2026-08-01')
  .lte('billing_date', '2026-08-31');
```

---

## ⚠️ 注意事项

### 1. 数据一致性

- ✅ `billing_date` 与 `bill_issued` 状态保持一致
- ✅ `bill_issued = true` → `billing_date` 有值
- ✅ `bill_issued = false` → `billing_date` 为 NULL

### 2. 手动修改限制

- ⚠️ **不要**手动修改 `orders.billing_date`
- ✅ 应该通过修改 `order_billing` 来间接更新
- ✅ 触发器会自动保持同步

### 3. 历史数据处理

如果 `orders` 表中已有 `billing_date` 数据：

```sql
-- 方案 1: 保留现有数据，从下一次更新开始同步
-- （无需操作）

-- 方案 2: 清空所有 billing_date，重新同步
UPDATE orders SET billing_date = NULL;
UPDATE order_billing SET updated_at = NOW();  -- 触发重新同步
```

---

## 📋 迁移脚本更新

### 新增内容

1. ✅ 添加 `billing_date` 字段到 `orders` 表
2. ✅ 更新触发器函数，添加条件同步逻辑
3. ✅ 更新验证逻辑，检查 `billing_date` 字段

### 文件位置

- `database-migrations/002_add_billing_display_fields.sql`

---

## 💬 总结

### 核心规则

**只有当 `bill_issued = true` 时，`billing_date` 才会同步到 `orders` 表。**

### 优势

1. ✅ **清晰的业务语义** - billing_date 表示实际出账日期
2. ✅ **数据一致性** - 与 bill_issued 状态保持同步
3. ✅ **易于查询** - 可以通过 billing_date 筛选已出账订单
4. ✅ **前端友好** - 可以直接显示账单状态

### 下一步

1. ✅ 执行更新后的迁移脚本
2. ✅ 验证 billing_date 同步逻辑
3. ✅ 更新前端代码使用 billing_date 字段
