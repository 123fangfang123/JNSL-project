# ex_rate_used 字段同步更新说明

## 📅 更新日期
2026-08-10

## 🎯 问题描述

之前的触发器脚本没有同步 `ex_rate_used` 字段到 `orders` 表，导致前端无法知道实际使用的汇率是多少。

---

## ✅ 解决方案

在触发器中添加 `ex_rate_used` 字段的同步逻辑，使用与 View 相同的汇率回退机制。

### 同步逻辑

```sql
-- Exchange Rate Used: Sync with fallback logic (same as view)
ex_rate_used = COALESCE(
    NEW.ex_rate_used,                                    -- 1. 账单汇率
    (SELECT config_value::NUMERIC FROM system_config     -- 2. 配置默认值
     WHERE config_key = 'default_exchange_rate'),
    get_default_exchange_rate(),                        -- 3. 动态函数
    6.75                                                 -- 4. 兜底值
)
```

**关键点**：
- ✅ 使用 **4 层汇率回退机制**（与 View 完全一致）
- ✅ 无论 `bill_issued` 是 true 还是 false，都同步 `ex_rate_used`
- ✅ 如果 `order_billing.ex_rate_used` 为 NULL，自动使用默认汇率

---

## 📊 同步效果对比

### 场景 1: bill_issued = true（已出账）

**order_billing 表**：
```sql
transaction_id = 'TXN001'
ex_rate_used = 6.75          -- 账单实际使用的汇率
bill_issued = true
```

**orders 表同步结果**：
```sql
transaction_id = 'TXN001'
ex_rate_used = 6.75          -- ✅ 直接同步账单汇率
```

---

### 场景 2: bill_issued = false，ex_rate_used 有值

**order_billing 表**：
```sql
transaction_id = 'TXN002'
ex_rate_used = 6.76          -- 估算时使用的汇率
bill_issued = false
```

**orders 表同步结果**：
```sql
transaction_id = 'TXN002'
ex_rate_used = 6.76          -- ✅ 同步估算汇率
```

---

### 场景 3: bill_issued = false，ex_rate_used 为 NULL

**order_billing 表**：
```sql
transaction_id = 'TXN003'
ex_rate_used = NULL          -- 未设置汇率
bill_issued = false
```

**orders 表同步结果**（应用回退机制）：
```sql
transaction_id = 'TXN003'
ex_rate_used = 6.75          -- ✅ 使用默认汇率（从 system_config 或 get_default_exchange_rate()）
```

**回退流程**：
```
NEW.ex_rate_used (NULL)
    ↓
system_config.default_exchange_rate (6.75)  ← 使用这个值
    ↓
get_default_exchange_rate() (备用)
    ↓
6.75 (兜底)
```

---

## 🛠️ 实施的修改

### 1. 添加 ex_rate_used 字段到 orders 表

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ex_rate_used NUMERIC(10,4);
COMMENT ON COLUMN orders.ex_rate_used IS '实际使用的汇率（bill_issued=true时使用账单汇率，false时使用回退后的默认汇率）';
```

### 2. 更新触发器函数

```sql
CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders o
    SET 
        -- ... 其他字段 ...
        
        -- Exchange Rate Used: Sync with fallback logic (same as view)
        ex_rate_used = COALESCE(
            NEW.ex_rate_used,
            (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
            get_default_exchange_rate(),
            6.75
        ),
        
        -- ... 其他字段 ...
    WHERE o.transaction_id = NEW.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. 更新验证逻辑

```sql
-- Check ex_rate_used column
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'ex_rate_used'
) INTO col_exists;

IF NOT col_exists THEN
    RAISE EXCEPTION 'Column ex_rate_used not found in orders table!';
END IF;
```

---

## 💡 前端使用示例

### 显示实际使用的汇率

```tsx
// components/OrderRow.tsx
export function OrderRow({ order }: { order: Order }) {
  return (
    <tr>
      <td>{order.order_number}</td>
      <td className="text-right">
        ${order.cog_usd?.toFixed(2)}
      </td>
      <td className="text-right text-xs text-gray-500">
        {/* 显示使用的汇率 */}
        Rate: {order.ex_rate_used?.toFixed(4) ?? '—'}
      </td>
      <td className="text-right">
        ${order.shipping_usd?.toFixed(2)}
      </td>
      <td className="text-right">
        ${order.fulfillment_usd?.toFixed(2)}
      </td>
      <td className="text-right font-bold">
        ${order.total_cost_usd?.toFixed(2)}
      </td>
    </tr>
  );
}
```

### 根据汇率判断账单状态

```tsx
// 如果有 billing_date，说明已出账，ex_rate_used 是账单汇率
// 如果没有 billing_date，说明未出账，ex_rate_used 是默认汇率
{order.billing_date ? (
  <span className="text-green-600 text-xs">
    Billed @ rate {order.ex_rate_used?.toFixed(4)}
  </span>
) : (
  <span className="text-amber-600 text-xs">
    Estimated @ rate {order.ex_rate_used?.toFixed(4)}
  </span>
)}
```

---

## ✅ 验证测试

### 测试 1: 已出账订单同步 ex_rate_used

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
    'TEST_RATE_001',
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
    ex_rate_used,
    billing_date
FROM orders
WHERE transaction_id = 'TEST_RATE_001';

-- 预期结果：
-- ex_rate_used = 6.75 ✅
-- billing_date = '2026-08-10' ✅
```

### 测试 2: 未出账订单，ex_rate_used 为 NULL

```sql
-- 插入未出账记录（ex_rate_used 为 NULL）
INSERT INTO order_billing (
    transaction_id,
    cog_cny,
    freight_est_cny,
    fulfillment_usd,
    ex_rate_used,  -- NULL
    bill_issued
) VALUES (
    'TEST_RATE_002',
    675.00,
    135.00,
    5.00,
    NULL,  -- ex_rate_used 为空
    false
);

-- 检查 orders 表
SELECT 
    transaction_id,
    ex_rate_used,
    billing_date
FROM orders
WHERE transaction_id = 'TEST_RATE_002';

-- 预期结果：
-- ex_rate_used = 6.75 (或其他默认值，取决于 system_config) ✅
-- billing_date = NULL ✅
```

### 测试 3: 验证回退机制

```sql
-- 检查 system_config 中的默认汇率
SELECT config_value 
FROM system_config 
WHERE config_key = 'default_exchange_rate';

-- 预期：应该返回配置的默认汇率（如 6.75）

-- 如果 system_config 为空，检查 get_default_exchange_rate() 函数
SELECT get_default_exchange_rate();

-- 预期：返回基于历史数据的平均汇率或 6.75
```

---

## 📋 完整的同步字段列表

| order_billing | orders 表 | 同步逻辑 |
|--------------|----------|---------|
| cog_billed_usd / 计算值 | cog_usd | 总是同步 |
| freight_billed_usd / 计算值 | shipping_usd | 总是同步 |
| fulfillment_usd | fulfillment_usd | 总是同步 |
| **ex_rate_used** | **ex_rate_used** | **总是同步（带回退）** ⭐ |
| billing_date | billing_date | 仅当 bill_issued = true |
| total_cost_usd / 计算值 | total_cost_usd | 总是同步 |

---

## 🔍 为什么需要同步 ex_rate_used？

### 原因 1: 透明度

用户需要知道：
- ✅ 这个金额是用什么汇率计算的？
- ✅ 是账单汇率还是默认汇率？

### 原因 2: 调试和审计

- ✅ 可以追溯每笔订单使用的汇率
- ✅ 便于财务对账和审计
- ✅ 发现汇率异常时可以快速定位

### 原因 3: 前端展示

- ✅ 可以在 UI 上显示"汇率：6.75"
- ✅ 帮助用户理解金额计算过程
- ✅ 提高用户体验和信任度

### 原因 4: 数据一致性

- ✅ orders 表和 View 使用相同的汇率
- ✅ 避免前端查询 View 和 orders 表得到不同结果
- ✅ 保证数据的一致性

---

## ⚠️ 注意事项

### 1. ex_rate_used 始终有值

由于使用了 COALESCE 回退机制，`orders.ex_rate_used` **永远不会是 NULL**：

```sql
-- 即使 order_billing.ex_rate_used 为 NULL
-- orders.ex_rate_used 也会有一个默认值（6.75 或其他）
```

### 2. 回退机制的优先级

```
1. order_billing.ex_rate_used (如果有值)
2. system_config.default_exchange_rate (如果配置了)
3. get_default_exchange_rate() (动态计算)
4. 6.75 (硬编码兜底)
```

### 3. 修改默认汇率的影响

如果修改了 `system_config.default_exchange_rate`：
- ✅ **新订单**会使用新的默认汇率
- ⚠️ **已有订单**的 `ex_rate_used` 不会自动更新
- 💡 如果需要更新已有订单，需要手动重新触发同步

---

## 📝 更新的文件

✅ [sync_billing_display_fields.sql](file:///d:/WPSDrive/1207746729/WPS云盘/杰纳思理新品/customer-portal/database-migrations/sync_billing_display_fields.sql) - 添加了 ex_rate_used 字段和同步逻辑

---

## 💬 总结

### 核心改进

1. ✅ **添加 ex_rate_used 字段**到 orders 表
2. ✅ **同步逻辑使用 4 层回退机制**（与 View 一致）
3. ✅ **无论 bill_issued 状态如何，都同步 ex_rate_used**
4. ✅ **确保 ex_rate_used 永远不为 NULL**

### 优势

- ✅ 前端可以显示实际使用的汇率
- ✅ 提高透明度和可追溯性
- ✅ 便于调试和审计
- ✅ 保证数据一致性

现在可以重新执行更新后的脚本了！
