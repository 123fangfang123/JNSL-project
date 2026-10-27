-- =====================================================
-- 迁移脚本：为 order_items 表添加 sku_standard_price 字段
-- 创建日期：2026-10-13
-- 说明：在 qty 字段前添加 SKU 标准售价字段
-- =====================================================

-- 添加 sku_standard_price 字段
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS sku_standard_price NUMERIC(10,2);

-- 添加字段注释
COMMENT ON COLUMN order_items.sku_standard_price IS '库存 SKU 标准售价（SKU Standard Price）';

-- 验证字段已添加
SELECT column_name, data_type, is_nullable, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'order_items'
AND column_name = 'sku_standard_price';
