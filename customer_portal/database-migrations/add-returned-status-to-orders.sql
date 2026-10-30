-- Add 'returned' status to order_status_enum
-- Date: 2026-10-30
-- Description: Add returned status for orders that have been returned

ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'returned';

COMMENT ON COLUMN orders.order_status IS '订单状态：received(待处理), processed(配货中), shipped(已发货), cancelled(已作废), returned(已退货)';

-- Verify
SELECT unnest(enum_range(NULL::order_status_enum)) AS status;
