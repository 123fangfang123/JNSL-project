# 默认汇率机制更新说明

## 📅 更新日期
2026-08-10

## ⚠️ 重要变更

**移除了 `order_ex_rate` 作为汇率回退选项**

### 原因
`orders.order_ex_rate` 可能不是美元汇率（可能是其他货币的汇率），因此不适合作为 USD/CNY 的默认汇率。

---

## 🔄 变更前后对比

### 变更前（4层回退）
```sql
COALESCE(
    ob.ex_rate_used,        -- 1. 账单汇率
    o.order_ex_rate,        -- 2. 订单汇率 ❌ 已移除
    (SELECT config_value FROM system_config ...),  -- 3. 配置表
    get_default_exchange_rate(),  -- 4. 动态函数
    6.75                    -- 5. 兜底值
)
```

### 变更后（3层回退）
```sql
COALESCE(
    ob.ex_rate_used,        -- 1. 账单汇率
    (SELECT config_value FROM system_config ...),  -- 2. 配置表
    get_default_exchange_rate(),  -- 3. 动态函数（基于 ex_rate_used）
    6.75                    -- 4. 兜底值
)
```

---

## 🛠️ 技术实现更新

### 1. 函数 `get_default_exchange_rate()`

**变更前**：
```sql
SELECT COALESCE(
    AVG(ex_rate_used),
    AVG(order_ex_rate),  -- ❌ 已移除
    6.75
) INTO default_rate
FROM orders
WHERE ex_rate_used IS NOT NULL OR order_ex_rate IS NOT NULL;
```

**变更后**：
```sql
SELECT COALESCE(
    AVG(ex_rate_used),  -- ✅ 只使用账单汇率
    6.75
) INTO default_rate
FROM orders
WHERE ex_rate_used IS NOT NULL;  -- ✅ 只查询有 ex_rate_used 的记录
```

### 2. View `orders_with_billing_display`

所有涉及汇率计算的地方都移除了 `o.order_ex_rate`，现在只使用：
1. `ob.ex_rate_used`（优先）
2. 配置的默认汇率
3. 动态函数计算的平均值
4. 硬编码兜底值 6.75

---

## 📊 影响分析

### 数据分布
根据现有 472 条订单：
- **63 条** (13.3%) 有 `ex_rate_used` → 使用实际账单汇率
- **409 条** (86.7%) 没有 `ex_rate_used` → 将使用配置的默认汇率 (6.75)

### 预期行为
- ✅ 有账单汇率的订单：显示准确的 billed 价格
- ✅ 没有账单汇率的订单：使用统一的默认汇率 6.75 计算估算价格
- ❌ 不再使用可能不准确的 `order_ex_rate`

---

## 📝 更新的文件

1. ✅ `database-migrations/001_create_order_billing_table.sql`
   - 更新了 `get_default_exchange_rate()` 函数
   - 更新了 View 中的所有 COALESCE 链

2. ✅ `docs/order-billing-implementation-guide.md`
   - 更新了汇率回退机制说明
   - 添加了重要说明：不使用 order_ex_rate

3. ✅ `docs/ORDER_BILLING_QUICK_REFERENCE.md`
   - 更新了默认汇率机制
   - 更新了 FAQ

4. ✅ `docs/DEFAULT_EXCHANGE_RATE_MECHANISM.md`
   - 更新了数据调查结果
   - 更新了汇率优先级说明
   - 更新了 SQL 实现代码

---

## ✅ 验证方法

### 测试 1: 检查汇率来源分布

```sql
SELECT 
    CASE 
        WHEN ob.ex_rate_used IS NOT NULL THEN 'bill_rate'
        ELSE 'default_rate'
    END as rate_source,
    COUNT(*) as count,
    ROUND(AVG(COALESCE(ob.ex_rate_used, 6.75)), 4) as avg_rate
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id
GROUP BY rate_source
ORDER BY count DESC;
```

**预期结果**：
```
rate_source  | count | avg_rate
-------------+-------+----------
bill_rate    |   63  |  6.7636
default_rate |  409  |  6.7500
```

### 测试 2: 验证没有使用 order_ex_rate

```sql
-- 这个查询应该返回 0，因为 View 中不再引用 order_ex_rate
SELECT COUNT(*)
FROM orders_with_billing_display
WHERE effective_ex_rate = order_ex_rate 
  AND ex_rate_used IS NULL;
```

---

## 💡 管理建议

### 1. 监控默认汇率使用情况

定期查看有多少订单使用了默认汇率：

```sql
SELECT 
    COUNT(*) FILTER (WHERE ob.ex_rate_used IS NOT NULL) as using_bill_rate,
    COUNT(*) FILTER (WHERE ob.ex_rate_used IS NULL) as using_default_rate,
    ROUND(
        COUNT(*) FILTER (WHERE ob.ex_rate_used IS NULL)::numeric / 
        COUNT(*) * 100, 1
    ) as default_rate_percentage
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id;
```

### 2. 适时更新默认汇率

如果市场汇率变化较大，可以更新配置表：

```sql
-- 查看当前配置
SELECT * FROM system_config WHERE config_key = 'default_exchange_rate';

-- 更新为新的默认值
UPDATE system_config 
SET 
    config_value = '6.80',
    description = 'Updated due to market changes',
    updated_at = NOW()
WHERE config_key = 'default_exchange_rate';
```

### 3. 考虑批量设置 ex_rate_used

对于大量没有 `ex_rate_used` 的历史订单，可以考虑批量设置：

```sql
-- 示例：为特定日期范围的订单设置统一汇率
UPDATE order_billing
SET ex_rate_used = 6.75
WHERE ex_rate_used IS NULL
  AND transaction_id IN (
    SELECT transaction_id 
    FROM orders 
    WHERE order_date >= '2026-01-01'
      AND order_date < '2026-07-01'
  );
```

---

## ⚠️ 注意事项

1. **准确性权衡**
   - 使用统一的默认汇率 (6.75) 可能不如每个订单的实际汇率准确
   - 但对于估算价格来说，这是可接受的折衷方案

2. **未来优化**
   - 如果需要更精确的估算，可以考虑：
     - 按月份维护不同的默认汇率
     - 从外部 API 获取历史汇率
     - 让用户手动输入缺失的 ex_rate_used

3. **向后兼容**
   - `orders.order_ex_rate` 字段仍然保留在表中
   - 只是不在 View 中使用它进行汇率计算
   - 可以用于其他用途（如审计、分析等）

---

## 🎯 总结

**核心变更**：
- ❌ 移除了 `order_ex_rate` 作为汇率回退选项
- ✅ 简化为 3 层回退机制
- ✅ 更加可靠和可控

**优势**：
- 避免了使用可能不准确的订单汇率
- 默认汇率可通过配置表灵活调整
- 逻辑更清晰，易于理解和维护

**影响**：
- 409 条没有 `ex_rate_used` 的订单将使用统一的默认汇率 6.75
- 估算价格的准确性略有降低，但在可接受范围内
- 系统行为更加一致和可预测

---

**最后更新**: 2026-08-10  
**相关文档**: 
- [order-billing-implementation-guide.md](./order-billing-implementation-guide.md)
- [ORDER_BILLING_QUICK_REFERENCE.md](./ORDER_BILLING_QUICK_REFERENCE.md)
- [DEFAULT_EXCHANGE_RATE_MECHANISM.md](./DEFAULT_EXCHANGE_RATE_MECHANISM.md)
