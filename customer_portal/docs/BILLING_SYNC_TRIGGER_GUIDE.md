# Billing 显示字段同步触发器 - 实施指南

## 📅 创建日期
2026-08-10

## 🎯 目标

创建一个自动同步机制，将 `order_billing` 表的账单数据同步到 `orders` 表的显示字段，使普通用户可以通过 `orders` 表查看账单金额（遵守 RLS）。

---

## 📊 架构设计

### 数据流

```
┌─────────────────────────────────────┐
│   order_billing 表 (仅 admin 访问)   │
│                                     │
│   - cog_billed_usd                  │
│   - freight_billed_usd              │
│   - fulfillment_usd                 │
│   - total_cost_usd                  │
│   - ex_rate_used                    │
│   - bill_issued                     │
└──────────────┬──────────────────────┘
               │
               │ INSERT / UPDATE
               ↓
┌─────────────────────────────────────┐
│   Trigger: sync_billing_to_orders() │
│                                     │
│   - 计算显示的 USD 值                │
│   - 应用汇率回退机制                 │
│   - 同步到 orders 表                 │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   orders 表 (所有用户可访问，RLS)    │
│                                     │
│   - cog_usd         ← 同步          │
│   - shipping_usd    ← 同步          │
│   - fulfillment_usd ← 同步          │
│   - total_cost_usd  ← 同步          │
└─────────────────────────────────────┘
```

---

## 🛠️ 实施步骤

### Step 1: 添加显示字段到 orders 表

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cog_usd NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_usd NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_usd NUMERIC(10,2);
-- total_cost_usd 已存在
```

**字段说明**：
- `cog_usd` - 显示的 COG 美元（billed 或 estimated）
- `shipping_usd` - 显示的运费美元（billed 或 estimated）
- `fulfillment_usd` - Fulfillment 费用美元
- `total_cost_usd` - 总成本美元（三项之和）

---

### Step 2: 创建同步函数

```sql
CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the corresponding order record with billing display values
    -- Use the same logic as orders_with_billing_display view to ensure consistency
    UPDATE orders o
    SET 
        -- COG USD: Same logic as view
        cog_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.cog_billed_usd
            WHEN NEW.cog_cny IS NOT NULL THEN
                ROUND(
                    (NEW.cog_cny + COALESCE(NEW.cog_premium_cny, 0)) / 
                    COALESCE(
                        NEW.ex_rate_used,
                        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                        get_default_exchange_rate(),  -- ← 使用与 View 相同的函数
                        6.75
                    ),
                2)
            ELSE NULL
        END,
        
        -- Shipping USD: Same logic as view
        shipping_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.freight_billed_usd
            WHEN NEW.freight_est_cny IS NOT NULL THEN
                ROUND(
                    NEW.freight_est_cny / 
                    COALESCE(
                        NEW.ex_rate_used,
                        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                        get_default_exchange_rate(),  -- ← 使用与 View 相同的函数
                        6.75
                    ),
                2)
            ELSE NULL
        END,
        
        -- Fulfillment USD: Always the same
        fulfillment_usd = NEW.fulfillment_usd,
        
        -- Total Cost USD: Same logic as view (sum of the three above)
        total_cost_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.total_cost_usd
            WHEN NEW.cog_cny IS NOT NULL THEN
                ROUND(...计算逻辑..., 2)  -- ← 使用与 View 相同的汇率回退机制
            ELSE NULL
        END,
        
        updated_at = NOW()
    WHERE o.transaction_id = NEW.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**计算逻辑**：

**重要**：触发器使用与 `orders_with_billing_display` View **完全相同**的计算逻辑，确保数据一致性。

**已出账（bill_issued = true）**：
```
cog_usd = cog_billed_usd
shipping_usd = freight_billed_usd
fulfillment_usd = fulfillment_usd
total_cost_usd = total_cost_usd（直接使用存储值）
```

**未出账（bill_issued = false）**：
```
effective_ex_rate = COALESCE(ex_rate_used, default_exchange_rate, 6.75)

cog_usd = (cog_cny + cog_premium_cny) / effective_ex_rate
shipping_usd = freight_est_cny / effective_ex_rate
fulfillment_usd = fulfillment_usd
total_cost_usd = cog_usd + shipping_usd + fulfillment_usd
```

---

### Step 3: 创建触发器

```sql
DROP TRIGGER IF EXISTS trigger_sync_billing_to_orders ON order_billing;

CREATE TRIGGER trigger_sync_billing_to_orders
AFTER INSERT OR UPDATE ON order_billing
FOR EACH ROW
EXECUTE FUNCTION sync_billing_to_orders();
```

**触发时机**：
- ✅ `INSERT` - 当新账单记录创建时
- ✅ `UPDATE` - 当账单记录更新时

---

## 🚀 执行迁移脚本

### 方法 1: Supabase SQL Editor（推荐）

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入项目 → **SQL Editor**
3. 打开 `database-migrations/002_add_billing_display_fields.sql`
4. 点击 **Run** 执行

**预期输出**：
```
✓ Sync trigger created successfully
✓ Existing X billing records will be synced to orders table
✓ All display columns verified
✓ Sync trigger verified
```

### 方法 2: 通过 API 执行

```bash
curl -X POST "https://your-project.supabase.co/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d @database-migrations/002_add_billing_display_fields.sql
```

---

## ✅ 验证测试

### 测试 1: 检查字段是否创建

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('cog_usd', 'shipping_usd', 'fulfillment_usd', 'total_cost_usd')
ORDER BY column_name;
```

**预期结果**：
```
column_name      | data_type | is_nullable
-----------------+-----------+------------
cog_usd          | numeric   | YES
shipping_usd     | numeric   | YES
fulfillment_usd  | numeric   | YES
total_cost_usd   | numeric   | YES
```

### 测试 2: 检查触发器是否创建

```sql
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_sync_billing_to_orders';
```

**预期结果**：
```
trigger_name                     | event_manipulation | event_object_table | action_statement
---------------------------------+--------------------+--------------------+-------------------
trigger_sync_billing_to_orders   | INSERT             | order_billing      | EXECUTE FUNCTION sync_billing_to_orders()
trigger_sync_billing_to_orders   | UPDATE             | order_billing      | EXECUTE FUNCTION sync_billing_to_orders()
```

### 测试 3: 测试同步功能（已出账）

```sql
-- 插入测试账单记录（已出账）
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
    'TEST_SYNC_001',
    100.00,
    20.00,
    5.00,
    125.00,
    6.75,
    '2026-08-10',
    true
);

-- 等待触发器执行
SELECT pg_sleep(0.1);

-- 检查 orders 表是否同步
SELECT 
    transaction_id,
    cog_usd,
    shipping_usd,
    fulfillment_usd,
    total_cost_usd
FROM orders
WHERE transaction_id = 'TEST_SYNC_001';

-- 预期结果：
-- cog_usd = 100.00
-- shipping_usd = 20.00
-- fulfillment_usd = 5.00
-- total_cost_usd = 125.00
```

### 测试 4: 测试同步功能（未出账）

```sql
-- 插入测试账单记录（未出账）
INSERT INTO order_billing (
    transaction_id,
    cog_cny,
    cog_premium_cny,
    freight_est_cny,
    fulfillment_usd,
    ex_rate_used,
    bill_issued
) VALUES (
    'TEST_SYNC_002',
    675.00,
    0,
    135.00,
    5.00,
    6.75,
    false
);

-- 等待触发器执行
SELECT pg_sleep(0.1);

-- 检查 orders 表是否同步
SELECT 
    transaction_id,
    cog_usd,
    shipping_usd,
    fulfillment_usd,
    total_cost_usd
FROM orders
WHERE transaction_id = 'TEST_SYNC_002';

-- 预期结果：
-- cog_usd = 675 / 6.75 = 100.00
-- shipping_usd = 135 / 6.75 = 20.00
-- fulfillment_usd = 5.00
-- total_cost_usd = 100 + 20 + 5 = 125.00
```

### 测试 5: 测试更新同步

```sql
-- 更新账单记录
UPDATE order_billing
SET cog_billed_usd = 110.00,
    total_cost_usd = 135.00  -- 110 + 20 + 5
WHERE transaction_id = 'TEST_SYNC_001';

-- 等待触发器执行
SELECT pg_sleep(0.1);

-- 检查 orders 表是否更新
SELECT 
    transaction_id,
    cog_usd,
    total_cost_usd
FROM orders
WHERE transaction_id = 'TEST_SYNC_001';

-- 预期结果：
-- cog_usd = 110.00（已更新）
-- total_cost_usd = 135.00（已更新）
```

### 测试 6: 普通用户查询测试

```sql
-- 以普通用户身份登录
SET ROLE authenticated;
SET request.jwt.claims.sub = 'customer-user-uuid';

-- 查询 orders 表的显示字段
SELECT 
    transaction_id,
    cog_usd,
    shipping_usd,
    fulfillment_usd,
    total_cost_usd
FROM orders
WHERE store_name IN (
    SELECT store_name FROM customers 
    WHERE auth_user_id = auth.uid()
);

-- 预期：✅ 返回该用户的订单及账单显示字段
-- 注意：orders 表需要有基于 store_name 的 RLS 策略
```

---

## 🔍 工作原理详解

### 触发器执行流程

```
1. 管理员插入/更新 order_billing
   ↓
2. 触发器自动触发
   ↓
3. 执行 sync_billing_to_orders() 函数
   ↓
4. 根据 bill_issued 状态计算显示值
   ↓
5. 应用汇率回退机制
   ↓
6. 更新 orders 表的对应记录
   ↓
7. 完成同步
```

### 汇率回退机制

```sql
COALESCE(
    NEW.ex_rate_used,                                    -- 1. 账单汇率
    (SELECT config_value FROM system_config ...),       -- 2. 配置默认值
    get_default_exchange_rate(),                        -- 3. 动态函数（基于历史 ex_rate_used）
    6.75                                                 -- 4. 兜底值
)
```

**优先级**：
1. `ex_rate_used` - 账单实际使用的汇率
2. `system_config.default_exchange_rate` - 配置的默认汇率
3. `get_default_exchange_rate()` - 动态计算的历史平均值
4. `6.75` - 硬编码兜底值

**重要**：
- ✅ 触发器使用与 View **完全相同**的汇率回退逻辑
- ✅ 确保 `orders` 表的显示字段与 View 计算结果一致
- ✅ 如果修改了 View 的逻辑，需要同步更新触发器

---

## 📋 前端使用示例

### 普通用户查询订单

```typescript
// app/(portal)/orders/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function OrdersPage() {
  const supabase = createClient()  // Anon Key（遵守 RLS）
  
  // 查询 orders 表，包含账单显示字段
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      transaction_id,
      order_number,
      store_name,
      cog_usd,           -- ← 同步的显示字段
      shipping_usd,      -- ← 同步的显示字段
      fulfillment_usd,   -- ← 同步的显示字段
      total_cost_usd     -- ← 同步的显示字段
    `)
    // RLS 自动应用：只返回当前用户的订单
  
  return <OrdersTable orders={orders} />
}
```

### 显示账单金额

```tsx
// components/OrderRow.tsx
export function OrderRow({ order }: { order: Order }) {
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
    </tr>
  )
}
```

---

## ⚠️ 注意事项

### 1. 性能考虑

- ✅ 触发器在 `AFTER INSERT/UPDATE` 时执行，不影响主事务
- ✅ 每次只更新一行，性能良好
- ⚠️ 批量导入时可能稍慢（每行都触发）

**优化建议**：
```sql
-- 批量导入时临时禁用触发器
ALTER TABLE order_billing DISABLE TRIGGER trigger_sync_billing_to_orders;

-- 执行批量导入
INSERT INTO order_billing ...;

-- 重新启用触发器
ALTER TABLE order_billing ENABLE TRIGGER trigger_sync_billing_to_orders;

-- 手动同步
UPDATE order_billing SET updated_at = NOW();
```

### 2. 数据一致性

- ✅ 触发器保证 `orders` 和 `order_billing` 数据一致
- ✅ 如果 `order_billing` 更新，`orders` 自动同步
- ⚠️ 不要手动修改 `orders` 表的显示字段（会被覆盖）

### 3. 错误处理

- ✅ 如果 `orders` 表没有对应记录，触发器不会报错（UPDATE 影响 0 行）
- ✅ 如果汇率为 NULL，使用默认值 6.75
- ⚠️ 确保 `system_config` 表有默认汇率配置

### 4. RLS 兼容性

- ✅ `orders` 表的 RLS 策略不受触发器影响
- ✅ 普通用户只能看到自己的订单（通过 RLS 过滤）
- ✅ 显示字段继承 `orders` 表的 RLS 策略

---

## 🔧 故障排查

### 问题 1: 触发器未执行

**症状**：插入 `order_billing` 后，`orders` 表未更新

**排查**：
```sql
-- 检查触发器是否存在
SELECT * FROM pg_trigger WHERE tgname = 'trigger_sync_billing_to_orders';

-- 检查触发器是否启用
SELECT tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trigger_sync_billing_to_orders';

-- tgenabled = 'O' 表示启用
-- tgenabled = 'D' 表示禁用
```

**解决**：
```sql
-- 重新启用触发器
ALTER TABLE order_billing ENABLE TRIGGER trigger_sync_billing_to_orders;
```

### 问题 2: 同步的值不正确

**症状**：`orders` 表的显示字段与预期不符

**排查**：
```sql
-- 对比两个表的数据
SELECT 
    ob.transaction_id,
    ob.cog_billed_usd,
    ob.freight_billed_usd,
    ob.fulfillment_usd,
    ob.total_cost_usd,
    ob.bill_issued,
    ob.ex_rate_used,
    o.cog_usd,
    o.shipping_usd,
    o.fulfillment_usd,
    o.total_cost_usd
FROM order_billing ob
LEFT JOIN orders o ON ob.transaction_id = o.transaction_id
WHERE ob.transaction_id = 'YOUR_TEST_ID';
```

**解决**：
- 检查 `bill_issued` 状态是否正确
- 检查 `ex_rate_used` 是否有值
- 检查 `system_config` 表是否有默认汇率

### 问题 3: 普通用户看不到数据

**症状**：普通用户查询 `orders` 表返回空结果

**排查**：
```sql
-- 检查 orders 表的 RLS 策略
SELECT * FROM pg_policies WHERE tablename = 'orders';

-- 检查用户角色
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- 检查 customers 表关联
SELECT * FROM customers WHERE auth_user_id = auth.uid();
```

**解决**：
- 确保 `orders` 表有正确的 RLS 策略
- 确保用户在 `customers` 表中有记录
- 确保 `store_name` 匹配正确

---

## 📝 维护指南

### 定期验证

```sql
-- 每月运行一次，检查数据一致性
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT ob.transaction_id) as billing_records,
    COUNT(DISTINCT o.transaction_id) as synced_orders,
    COUNT(CASE WHEN ob.bill_issued = true AND o.cog_usd != ob.cog_billed_usd THEN 1 END) as mismatches
FROM order_billing ob
LEFT JOIN orders o ON ob.transaction_id = o.transaction_id;
```

### 重新同步所有数据

```sql
-- 强制重新同步所有账单记录
UPDATE order_billing SET updated_at = NOW();
```

### 监控触发器性能

```sql
-- 查看触发器执行统计
SELECT 
    schemaname,
    relname,
    trigger_name,
    pg_stat_get_function_calls(oid) as calls,
    pg_stat_get_function_total_time(oid) as total_time_ms
FROM pg_stat_user_functions
WHERE funcname = 'sync_billing_to_orders';
```

---

## 💬 总结

### 核心优势

1. ✅ **自动化** - 无需手动同步，触发器自动处理
2. ✅ **实时性** - 数据变更立即同步
3. ✅ **安全性** - 普通用户通过 RLS 安全访问
4. ✅ **一致性** - 保证 orders 和 order_billing 数据一致
5. ✅ **灵活性** - 支持 billed 和 estimated 两种模式

### 数据流

```
Admin → order_billing (原始数据)
         ↓ Trigger
      orders (显示字段)
         ↓ RLS
      Customer UI (安全访问)
```

### 下一步

1. ✅ 执行迁移脚本 `002_add_billing_display_fields.sql`
2. ✅ 验证触发器是否正常工作
3. ✅ 测试普通用户查询
4. ✅ 更新前端代码使用新的显示字段
