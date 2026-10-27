-- =====================================================
-- 迁移脚本：为 orders 表添加 shipment_date（交运日期）字段
-- 创建日期：2026-10-13
-- 说明：在 dispatch_date 字段前添加交运日期字段
-- =====================================================

-- 添加 shipment_date 字段
ALTER TABLE orders
ADD COLUMN shipment_date DATE;

-- 添加字段注释
COMMENT ON COLUMN orders.shipment_date IS '交运日期（Shipment Date）';

-- 验证字段已添加
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name = 'shipment_date';
