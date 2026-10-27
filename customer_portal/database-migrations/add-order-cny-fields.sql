-- 为 orders 表添加订单金额相关字段
-- Date: 2026-08-06

-- 添加 order_cny_value 字段（订单人民币金额）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_cny_value NUMERIC(12,2) DEFAULT NULL;

-- 添加 order_ex_rate 字段（订单汇率）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_ex_rate NUMERIC(10,4) DEFAULT NULL;

-- 添加注释说明字段用途
COMMENT ON COLUMN orders.order_cny_value IS '订单原始人民币金额（来自 ERP 系统）';
COMMENT ON COLUMN orders.order_ex_rate IS '订单使用的汇率（用于 CNY → USD 转换）';
