-- =====================================================
-- 迁移脚本：为 orders 表添加退货相关字段
-- 创建日期：2026-10-13
-- 说明：添加 is_return（是否退货）和 return_qty（退货数量）字段
-- =====================================================

-- 添加 is_return 字段
ALTER TABLE orders
ADD COLUMN is_return BOOLEAN DEFAULT false;

-- 添加字段注释
COMMENT ON COLUMN orders.is_return IS '是否退货（Is Return）';

-- 添加 return_qty 字段
ALTER TABLE orders
ADD COLUMN return_qty NUMERIC;

-- 添加字段注释
COMMENT ON COLUMN orders.return_qty IS '退货数量（Return Quantity）';

-- 验证字段已添加
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('is_return', 'return_qty');
