# 默认汇率处理机制

## 📊 问题分析

在 order_billing 表中，`ex_rate_used` 字段可能为 NULL（特别是对于尚未出账的订单）。当计算估算价格时，需要一个合理的默认汇率。

## 🔍 数据调查结果

根据对现有 472 条订单数据的分析：

| 指标 | 数值 |
|------|------|
| 有 `ex_rate_used` 的记录 | 63 条 (13.3%) |
| 有 `order_ex_rate` 的记录 | 472 条 (100%) |
| `ex_rate_used` 平均值 | 6.7636 |
| `ex_rate_used` 范围 | 6.7621 - 6.7656 |
| `order_ex_rate` 平均值 | 6.7510 |
| `order_ex_rate` 范围 | 1 - 6.778 |

**关键发现**：
- ⚠️ 只有 13.3% 的订单有 `ex_rate_used`
- ❌ **不使用** `order_ex_rate`，因为它可能不是美元汇率
- 💡 需要配置默认汇率作为回退

## 🎯 解决方案：多层回退机制

### 汇率优先级（从高到低）

```
1. order_billing.ex_rate_used                    ← 账单汇率（最准确）
   ↓ 如果为 NULL
2. system_config.default_exchange_rate           ← 配置表默认值（6.75）
   ↓ 如果配置表为空
3. get_default_exchange_rate()                   ← 动态计算历史平均值（基于 ex_rate_used）
   ↓ 如果无法计算
4. 6.75                                          ← 硬编码兜底值
```

**重要说明**：
- ❌ **不使用** `orders.order_ex_rate`，因为它可能不是美元汇率
- ✅ **只使用** `ex_rate_used` 和配置的默认汇率

### SQL 实现

```sql
COALESCE(
    ob.ex_rate_used,                                    -- 1. 账单汇率
    (SELECT config_value::NUMERIC FROM system_config    -- 2. 配置表
     WHERE config_key = 'default_exchange_rate'),
    get_default_exchange_rate(),                        -- 3. 动态函数（基于 ex_rate_used）
    6.75                                                -- 4. 兜底值
) as effective_ex_rate
```

## 🛠️ 技术实现

### 1. 辅助函数：get_default_exchange_rate()

```sql
CREATE OR REPLACE FUNCTION get_default_exchange_rate() 
RETURNS NUMERIC(10,4) AS $$
DECLARE
    default_rate NUMERIC(10,4);
BEGIN
    -- 从已有数据中计算平均汇率作为默认值
    -- 只使用 ex_rate_used（账单汇率），不使用 order_ex_rate（可能不是美元汇率）
    SELECT COALESCE(
        AVG(ex_rate_used),
        6.75  -- 兜底值
    ) INTO default_rate
    FROM orders
    WHERE ex_rate_used IS NOT NULL;
    
    RETURN ROUND(default_rate, 4);
END;
$$ LANGUAGE plpgsql;
```

**特点**：
- 自动计算历史平均值
- 随着数据积累会更准确
- 当前返回值约为 6.7636

### 2. 配置表：system_config

```sql
CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认汇率配置
INSERT INTO system_config (config_key, config_value, description)
VALUES (
    'default_exchange_rate',
    '6.75',
    'Default USD/CNY exchange rate when ex_rate_used is NULL'
)
ON CONFLICT (config_key) DO NOTHING;
```

**优势**：
- 可以手动调整默认汇率
- 不需要修改代码或重新部署
- 适合应对汇率大幅波动

### 3. View 中的应用

```sql
CREATE OR REPLACE VIEW orders_with_billing_display AS
SELECT 
    o.*,
    ob.*,
    
    -- 实际使用的汇率
    COALESCE(
        ob.ex_rate_used,
        o.order_ex_rate,
        (SELECT config_value::NUMERIC FROM system_config 
         WHERE config_key = 'default_exchange_rate'),
        get_default_exchange_rate(),
        6.75
    ) as effective_ex_rate,
    
    -- 显示的 COG USD
    CASE 
        WHEN ob.bill_issued = true THEN ob.cog_billed_usd
        WHEN ob.cog_cny IS NOT NULL THEN
            ROUND(
                (ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / 
                COALESCE(
                    ob.ex_rate_used,
                    o.order_ex_rate,
                    (SELECT config_value::NUMERIC FROM system_config 
                     WHERE config_key = 'default_exchange_rate'),
                    get_default_exchange_rate(),
                    6.75
                ), 
            2)
        ELSE NULL
    END as cog_usd,
    
    -- ... 其他字段类似
    
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id;
```

## 📝 管理操作

### 查看当前默认汇率

```sql
-- 方法 1: 查询配置表
SELECT * FROM system_config WHERE config_key = 'default_exchange_rate';

-- 方法 2: 调用函数
SELECT get_default_exchange_rate();

-- 方法 3: 查看实际使用情况
SELECT 
    COUNT(*) as total_orders,
    COUNT(ob.ex_rate_used) as with_bill_rate,
    COUNT(o.order_ex_rate) as with_order_rate,
    AVG(COALESCE(ob.ex_rate_used, o.order_ex_rate)) as avg_effective_rate
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id;
```

### 修改默认汇率

```sql
-- 更新配置表
UPDATE system_config 
SET 
    config_value = '6.80',
    description = 'Updated default rate due to market changes',
    updated_at = NOW()
WHERE config_key = 'default_exchange_rate';

-- 验证更新
SELECT * FROM system_config WHERE config_key = 'default_exchange_rate';
```

### 刷新动态默认汇率

```sql
-- 如果需要重新计算历史平均值
SELECT get_default_exchange_rate();

-- 或者更新配置表为最新平均值
UPDATE system_config 
SET 
    config_value = (SELECT get_default_exchange_rate()::TEXT),
    updated_at = NOW()
WHERE config_key = 'default_exchange_rate';
```

## ✅ 验证测试

### 测试 1: 检查是否有 NULL 汇率

```sql
-- 应该返回 0
SELECT COUNT(*) 
FROM orders_with_billing_display
WHERE effective_ex_rate IS NULL;
```

### 测试 2: 验证汇率分布

```sql
SELECT 
    CASE 
        WHEN ob.ex_rate_used IS NOT NULL THEN 'bill_rate'
        WHEN o.order_ex_rate IS NOT NULL THEN 'order_rate'
        ELSE 'default_rate'
    END as rate_source,
    COUNT(*) as count,
    ROUND(AVG(COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75)), 4) as avg_rate
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id
GROUP BY rate_source
ORDER BY count DESC;
```

预期输出：
```
rate_source  | count | avg_rate
-------------+-------+----------
order_rate   |  409  |  6.7510
bill_rate    |   63  |  6.7636
default_rate |    0  |  6.7500
```

### 测试 3: 验证估算价格计算

```sql
-- 检查 bill_issued = false 的订单
SELECT 
    ob.transaction_id,
    ob.cog_cny,
    ob.cog_premium_cny,
    COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75) as effective_rate,
    ROUND((ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / 
          COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75), 2) as calculated_cog_usd,
    obd.cog_usd as view_cog_usd,
    CASE 
        WHEN ROUND((ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / 
                   COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75), 2) = obd.cog_usd 
        THEN '✓ Match'
        ELSE '✗ Mismatch'
    END as validation
FROM orders o
JOIN order_billing ob ON o.transaction_id = ob.transaction_id
JOIN orders_with_billing_display obd ON o.transaction_id = obd.transaction_id
WHERE ob.bill_issued = false
LIMIT 10;
```

所有记录应该显示 "✓ Match"。

## 🎯 最佳实践

### 1. 监控汇率使用分布

定期运行以下查询，了解汇率来源分布：

```sql
SELECT 
    DATE_TRUNC('month', o.order_date) as month,
    COUNT(*) FILTER (WHERE ob.ex_rate_used IS NOT NULL) as bill_rate_count,
    COUNT(*) FILTER (WHERE ob.ex_rate_used IS NULL AND o.order_ex_rate IS NOT NULL) as order_rate_count,
    COUNT(*) FILTER (WHERE ob.ex_rate_used IS NULL AND o.order_ex_rate IS NULL) as default_rate_count
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id
GROUP BY month
ORDER BY month DESC;
```

### 2. 适时更新默认汇率

建议每季度检查一次：

```sql
-- 检查当前默认汇率是否合理
SELECT 
    get_default_exchange_rate() as current_avg,
    (SELECT config_value::NUMERIC FROM system_config 
     WHERE config_key = 'default_exchange_rate') as configured_default,
    ABS(get_default_exchange_rate() - 
        (SELECT config_value::NUMERIC FROM system_config 
         WHERE config_key = 'default_exchange_rate')) as difference;
```

如果差异超过 0.05，考虑更新配置。

### 3. 记录汇率变更

在 system_config 中添加审计日志：

```sql
ALTER TABLE system_config 
ADD COLUMN changed_by TEXT,
ADD COLUMN change_reason TEXT;

-- 更新时记录原因
UPDATE system_config 
SET 
    config_value = '6.80',
    changed_by = 'admin',
    change_reason = 'Quarterly review - market rate adjustment',
    updated_at = NOW()
WHERE config_key = 'default_exchange_rate';
```

## ⚠️ 注意事项

1. **所有订单都有 order_ex_rate**
   - 根据调查，472/472 条记录都有 order_ex_rate
   - 因此实际上很少会用到配置表的默认值
   - 配置表主要作为额外的安全保障

2. **汇率精度**
   - 所有汇率都保留 4 位小数
   - 计算结果保留 2 位小数（货币标准）

3. **性能影响**
   - COALESCE 链式调用性能良好
   - system_config 表很小，查询速度快
   - get_default_exchange_rate() 只在必要时调用

4. **未来优化**
   - 如果 performance 成为问题，可以考虑将 effective_ex_rate 物化到 order_billing 表
   - 或者使用 Materialized View 缓存计算结果

## 📞 故障排查

### 问题 1: 发现 NULL 的 effective_ex_rate

```sql
-- 查找问题记录
SELECT o.transaction_id, ob.ex_rate_used, o.order_ex_rate
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id
LEFT JOIN orders_with_billing_display obd ON o.transaction_id = obd.transaction_id
WHERE obd.effective_ex_rate IS NULL;

-- 修复：手动设置汇率
UPDATE order_billing
SET ex_rate_used = 6.75
WHERE transaction_id = 'problem_txn_id';
```

### 问题 2: 估算价格异常

```sql
-- 检查是否有异常的汇率值
SELECT ob.transaction_id, 
       COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75) as rate,
       ob.cog_cny,
       ROUND(ob.cog_cny / COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75), 2) as cog_usd
FROM orders o
JOIN order_billing ob ON o.transaction_id = ob.transaction_id
WHERE ob.bill_issued = false
  AND COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75) < 5  -- 异常低的汇率
  OR COALESCE(ob.ex_rate_used, o.order_ex_rate, 6.75) > 8;  -- 异常高的汇率
```

---

**最后更新**: 2026-08-10  
**数据来源**: 472 条订单记录分析
