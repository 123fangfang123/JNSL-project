-- =====================================================
-- 迁移脚本：将 orders 表中 currency 字段的 CNY 修改为 USD
-- 创建日期：2026-10-14
-- 说明：将所有 currency 为 CNY 的记录更新为 USD，
--       并确保字段默认值为 USD
-- =====================================================

-- 1. 将现有 CNY 记录更新为 USD
UPDATE orders
SET currency = 'USD'
WHERE currency = 'CNY';

-- 2. 确保字段默认值为 USD（如果之前未设置或设置不同）
ALTER TABLE orders
ALTER COLUMN currency SET DEFAULT 'USD';

-- 3. 验证更新结果
SELECT currency, COUNT(*) AS record_count
FROM orders
GROUP BY currency;
