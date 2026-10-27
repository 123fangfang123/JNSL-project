-- =====================================================
-- Billing Display Fields Sync Trigger
-- Date: 2026-08-10
-- Description: 
--   Creates a trigger to automatically sync billing display fields
--   from order_billing table to orders table
--   
--   When bill_issued = true:
--     - Sync actual billed values (cog_billed_usd, freight_billed_usd, etc.)
--     - Sync billing_date
--   
--   When bill_issued = false:
--     - Calculate estimated USD values from CNY using exchange rate
--     - Clear billing_date (set to NULL)
--
-- Prerequisites:
--   1. order_billing table must exist
--   2. orders table must have these columns:
--      - cog_usd NUMERIC(10,2)
--      - shipping_usd NUMERIC(10,2)
--      - fulfillment_usd NUMERIC(10,2)
--      - billing_date DATE
--      - total_cost_usd NUMERIC(10,2)
--   3. system_config table must exist with default_exchange_rate
--   4. get_default_exchange_rate() function must exist
-- =====================================================

-- =====================================================
-- Step 1: Add display fields to orders table (if not exists)
-- =====================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cog_usd NUMERIC(10,2);
COMMENT ON COLUMN orders.cog_usd IS '显示的 COG USD（已出账时使用 billed，未出账时估算）';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_usd NUMERIC(10,2);
COMMENT ON COLUMN orders.shipping_usd IS '显示的 Shipping USD（已出账时使用 billed，未出账时估算）';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_usd NUMERIC(10,2);
COMMENT ON COLUMN orders.fulfillment_usd IS 'Fulfillment 费用 USD（始终以 USD 存储）';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_date DATE;
COMMENT ON COLUMN orders.billing_date IS '账单日期（仅在 bill_issued = true 时同步）';

-- ex_rate_used: Exchange rate used for calculation (synced with fallback logic)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ex_rate_used NUMERIC(10,4);
COMMENT ON COLUMN orders.ex_rate_used IS '实际使用的汇率（bill_issued=true时使用账单汇率，false时使用回退后的默认汇率）';

-- Note: total_cost_usd should already exist in orders table
COMMENT ON COLUMN orders.total_cost_usd IS '总成本 USD（cog_usd + shipping_usd + fulfillment_usd，自动同步）';

-- =====================================================
-- Step 2: Create or replace sync function
-- =====================================================

CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the corresponding order record with billing display values
    -- Use the same logic as orders_with_billing_display view to ensure consistency
    UPDATE orders o
    SET 
        -- COG USD: Same logic as view
        cog_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.cog_billed_usd
            WHEN NEW.cog_cny IS NOT NULL THEN
                ROUND(
                    (NEW.cog_cny + COALESCE(NEW.cog_premium_cny, 0)) / 
                    COALESCE(
                        NEW.ex_rate_used,
                        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                        get_default_exchange_rate(),
                        6.75
                    ),
                2)
            ELSE NULL
        END,
        
        -- Shipping USD: Same logic as view
        shipping_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.freight_billed_usd
            WHEN NEW.freight_est_cny IS NOT NULL THEN
                ROUND(
                    NEW.freight_est_cny / 
                    COALESCE(
                        NEW.ex_rate_used,
                        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                        get_default_exchange_rate(),
                        6.75
                    ),
                2)
            ELSE NULL
        END,
        
        -- Fulfillment USD: Always the same
        fulfillment_usd = NEW.fulfillment_usd,
        
        -- Exchange Rate Used: Sync with fallback logic (same as view)
        ex_rate_used = COALESCE(
            NEW.ex_rate_used,
            (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
            get_default_exchange_rate(),
            6.75
        ),
        
        -- Billing Date: Only sync when bill_issued = true
        billing_date = CASE 
            WHEN NEW.bill_issued = true THEN NEW.billing_date
            ELSE NULL  -- Clear billing_date if bill_issued becomes false
        END,
        
        -- Total Cost USD: Same logic as view (sum of the three above)
        total_cost_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.total_cost_usd
            WHEN NEW.cog_cny IS NOT NULL THEN
                ROUND(
                    -- COG USD
                    ((NEW.cog_cny + COALESCE(NEW.cog_premium_cny, 0)) / 
                     COALESCE(
                         NEW.ex_rate_used,
                         (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                         get_default_exchange_rate(),
                         6.75
                     )) +
                    -- Shipping USD
                    (CASE 
                        WHEN NEW.freight_est_cny IS NOT NULL THEN 
                            NEW.freight_est_cny / 
                            COALESCE(
                                NEW.ex_rate_used,
                                (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                                get_default_exchange_rate(),
                                6.75
                            )
                        ELSE 0 
                    END) +
                    -- Fulfillment USD
                    COALESCE(NEW.fulfillment_usd, 0),
                2)
            ELSE NULL
        END,
        
        -- Update timestamp
        updated_at = NOW()
    WHERE o.transaction_id = NEW.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_billing_to_orders IS '自动同步 order_billing 的显示字段到 orders 表（使用与 View 相同的计算逻辑）';

-- =====================================================
-- Step 3: Create trigger
-- =====================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_billing_to_orders ON order_billing;

-- Create trigger: fires after INSERT or UPDATE on order_billing
CREATE TRIGGER trigger_sync_billing_to_orders
AFTER INSERT OR UPDATE ON order_billing
FOR EACH ROW
EXECUTE FUNCTION sync_billing_to_orders();

COMMENT ON TRIGGER trigger_sync_billing_to_orders ON order_billing IS '当 order_billing 更新时，自动同步显示字段到 orders 表';

-- =====================================================
-- Step 4: Verification
-- =====================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    trigger_exists BOOLEAN;
BEGIN
    -- Check cog_usd column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'cog_usd'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column cog_usd not found in orders table!';
    END IF;
    
    -- Check shipping_usd column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shipping_usd'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column shipping_usd not found in orders table!';
    END IF;
    
    -- Check fulfillment_usd column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'fulfillment_usd'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column fulfillment_usd not found in orders table!';
    END IF;
    
    -- Check billing_date column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'billing_date'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column billing_date not found in orders table!';
    END IF;
    
    -- Check ex_rate_used column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'ex_rate_used'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column ex_rate_used not found in orders table!';
    END IF;
    
    -- Check trigger exists
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_sync_billing_to_orders'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        RAISE EXCEPTION 'Trigger trigger_sync_billing_to_orders not found!';
    END IF;
    
    RAISE NOTICE '✓ All display columns verified';
    RAISE NOTICE '✓ Sync trigger created successfully';
    RAISE NOTICE '✓ Trigger will sync data when order_billing is INSERTED or UPDATED';
END $$;

-- =====================================================
-- Usage Examples
-- =====================================================

-- Example 1: Insert billed order (bill_issued = true)
-- This will sync actual billed values and billing_date to orders table
/*
INSERT INTO order_billing (
    transaction_id,
    cog_billed_usd,
    freight_billed_usd,
    fulfillment_usd,
    total_cost_usd,
    ex_rate_used,
    billing_date,
    bill_issued
) VALUES (
    'TXN001',
    100.00,
    20.00,
    5.00,
    125.00,
    6.75,
    '2026-08-10',
    true
);

-- Check synced data in orders table
SELECT 
    transaction_id,
    cog_usd,           -- Should be 100.00 (billed value)
    shipping_usd,      -- Should be 20.00 (billed value)
    fulfillment_usd,   -- Should be 5.00
    ex_rate_used,      -- Should be 6.75 (actual rate used)
    billing_date,      -- Should be '2026-08-10'
    total_cost_usd     -- Should be 125.00
FROM orders
WHERE transaction_id = 'TXN001';
*/

-- Example 2: Insert unbilled order (bill_issued = false)
-- This will calculate estimated USD values from CNY and clear billing_date
/*
INSERT INTO order_billing (
    transaction_id,
    cog_cny,
    cog_premium_cny,
    freight_est_cny,
    fulfillment_usd,
    ex_rate_used,
    bill_issued
) VALUES (
    'TXN002',
    675.00,
    0,
    135.00,
    5.00,
    6.75,
    false
);

-- Check synced data in orders table
SELECT 
    transaction_id,
    cog_usd,           -- Should be 100.00 (675 / 6.75, estimated)
    shipping_usd,      -- Should be 20.00 (135 / 6.75, estimated)
    fulfillment_usd,   -- Should be 5.00
    ex_rate_used,      -- Should be 6.75 (default rate from fallback)
    billing_date,      -- Should be NULL (not billed yet)
    total_cost_usd     -- Should be 125.00 (100 + 20 + 5, estimated)
FROM orders
WHERE transaction_id = 'TXN002';
*/

-- Example 3: Update from unbilled to billed
-- This will change from estimated values to actual billed values
/*
UPDATE order_billing
SET 
    bill_issued = true,
    billing_date = '2026-08-10',
    cog_billed_usd = 105.00,      -- Actual billed amount (may differ from estimate)
    freight_billed_usd = 22.00,   -- Actual billed amount
    total_cost_usd = 132.00       -- 105 + 22 + 5
WHERE transaction_id = 'TXN002';

-- Check updated data in orders table
SELECT 
    transaction_id,
    cog_usd,           -- Should now be 105.00 (actual billed)
    shipping_usd,      -- Should now be 22.00 (actual billed)
    ex_rate_used,      -- Should reflect the rate used for calculation
    billing_date,      -- Should now be '2026-08-10'
    total_cost_usd     -- Should now be 132.00 (actual total)
FROM orders
WHERE transaction_id = 'TXN002';
*/
