-- ALTER order_pricing.order_cny_value: NUMERIC(12,2) -> NUMERIC(14,4)
-- Preserve original amount precision
-- Date: 2026-10-15

ALTER TABLE order_pricing ALTER COLUMN order_cny_value TYPE NUMERIC(14,4);
