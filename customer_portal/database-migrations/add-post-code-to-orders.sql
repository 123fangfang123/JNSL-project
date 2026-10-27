-- =====================================================
-- 迁移脚本：为 orders 表添加 post_code（邮编）字段
-- 创建日期：2026-10-13
-- 说明：在 country 字段后添加邮编字段
-- =====================================================

-- 添加 post_code 字段
ALTER TABLE orders
ADD COLUMN post_code TEXT;

-- 添加字段注释
COMMENT ON COLUMN orders.post_code IS '邮编（Postal Code）';

-- 验证字段已添加
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name = 'post_code';
