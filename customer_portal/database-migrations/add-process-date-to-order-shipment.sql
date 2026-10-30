-- 为 order_shipment 表添加 process_date 字段
-- Date: 2026-10-28
-- 原因: 代码在导入订单时向 order_shipment 写入 process_date，
--       但线上库缺少该列，导致 "Could not find the 'process_date' column" 错误

ALTER TABLE order_shipment ADD COLUMN IF NOT EXISTS process_date DATE DEFAULT NULL;

COMMENT ON COLUMN order_shipment.process_date IS '交运时间（订单处理日期）';
