-- =====================================================
-- 综合迁移脚本：为 orders 表添加所有缺失字段
-- 创建日期：2026-10-13
-- 说明：添加 shipment_date, post_code, is_return, return_qty, cancel_date
-- =====================================================

-- 1. 添加 shipment_date 字段（交运日期）
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipment_date DATE;

COMMENT ON COLUMN orders.shipment_date IS '交运日期（Shipment Date）';

-- 2. 添加 post_code 字段（邮编）
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS post_code TEXT;

COMMENT ON COLUMN orders.post_code IS '邮编（Postal Code）';

-- 3. 添加 is_return 字段（是否退货）
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS is_return BOOLEAN DEFAULT false;

COMMENT ON COLUMN orders.is_return IS '是否退货（Is Return）';

-- 4. 添加 return_qty 字段（退货数量）
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS return_qty NUMERIC;

COMMENT ON COLUMN orders.return_qty IS '退货数量（Return Quantity）';

-- 5. 添加 cancel_date 字段（作废日期）
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS cancel_date DATE;

COMMENT ON COLUMN orders.cancel_date IS '作废日期（Cancel Date）';

-- 验证所有字段已添加
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('shipment_date', 'post_code', 'is_return', 'return_qty', 'cancel_date')
ORDER BY ordinal_position;
