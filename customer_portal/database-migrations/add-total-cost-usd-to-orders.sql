-- Migration: Add total_cost_usd field to orders table
-- Date: 2026-08-06
-- Description: Adds a total_cost_usd column to store the sum of cog_usd, shipping_usd, and fulfillment_usd
--              This is useful for customers who need a single total quote

-- Step 1: Add the new column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS total_cost_usd NUMERIC(10,2);

-- Step 2: Backfill existing billed records with calculated total_cost_usd
UPDATE orders 
SET total_cost_usd = COALESCE(cog_usd, 0) + COALESCE(shipping_usd, 0) + COALESCE(fulfillment_usd, 0)
WHERE billing_date IS NOT NULL;

-- Step 3: Add a comment to document the field
COMMENT ON COLUMN orders.total_cost_usd IS 'Total cost in USD (cog_usd + shipping_usd + fulfillment_usd). Auto-calculated during billing confirmation.';

-- Verification query (optional - run to check results)
-- SELECT transaction_id, cog_usd, shipping_usd, fulfillment_usd, total_cost_usd
-- FROM orders 
-- WHERE billing_date IS NOT NULL
-- LIMIT 10;
