-- 为 orders 表添加交运时间和发货时间字段
-- Date: 2026-08-07

-- 添加 process_date 字段（交运时间）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS process_date DATE DEFAULT NULL;

-- 添加 dispatch_date 字段（发货时间）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_date DATE DEFAULT NULL;

-- 添加注释说明字段用途
COMMENT ON COLUMN orders.process_date IS '交运时间（订单处理日期）';
COMMENT ON COLUMN orders.dispatch_date IS '发货时间（实际发货日期）';
