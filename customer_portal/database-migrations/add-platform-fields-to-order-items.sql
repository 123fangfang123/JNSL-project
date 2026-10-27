-- =====================================================
-- 迁移脚本：为 order_items 表添加平台商品标题和 SKU 图片链接字段
-- 创建日期：2026-10-13
-- 说明：在 qty 字段后添加 platform_product_title 和 sku_image_url 字段
-- =====================================================

-- 1. 添加 platform_product_title 字段（平台商品标题）
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS platform_product_title TEXT;

COMMENT ON COLUMN order_items.platform_product_title IS '平台商品标题（Platform Product Title）';

-- 2. 添加 sku_image_url 字段（SKU 原始图片链接）
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS sku_image_url TEXT;

COMMENT ON COLUMN order_items.sku_image_url IS 'SKU 原始图片链接（SKU Image URL）';

-- 验证字段已添加
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'order_items'
AND column_name IN ('platform_product_title', 'sku_image_url')
ORDER BY ordinal_position;
