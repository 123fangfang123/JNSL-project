-- =====================================================
-- 迁移脚本：为 orders 表添加 cancel_date（作废日期）字段
-- 创建日期：2026-10-13
-- 说明：在 billing_date 字段后添加作废日期字段
-- =====================================================

-- 添加 cancel_date 字段
ALTER TABLE orders
ADD COLUMN cancel_date DATE;

-- 添加字段注释
COMMENT ON COLUMN orders.cancel_date IS '作废日期（Cancel Date）';

-- 验证字段已添加
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name = 'cancel_date';
