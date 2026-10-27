-- =====================================================
-- 迁移脚本：为 orders 表添加 currency 字段
-- 创建日期：2026-10-13
-- 说明：在 order_ex_rate 字段后添加币种字段
-- =====================================================

-- 添加 currency 字段
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- 添加字段注释
COMMENT ON COLUMN orders.currency IS '币种（Currency），默认为 USD';

-- 验证字段已添加
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name = 'currency';
