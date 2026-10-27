-- Migration: Add billing display fields to orders table and create sync trigger
-- Date: 2026-08-10
-- Description: 
--   1. Adds display fields (cog_usd, shipping_usd, fulfillment_usd) to orders table
--   2. Creates a trigger to automatically sync these fields from order_billing table
--   3. Allows regular users to view billing amounts through orders table (with RLS)

-- =====================================================
-- Step 1: Add display fields to orders table
-- =====================================================

-- cog_usd: Display value for COG (billed or estimated)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cog_usd NUMERIC(10,2);
COMMENT ON COLUMN orders.cog_usd IS '显示的 COG USD（已出账时使用 billed，未出账时估算）';

-- shipping_usd: Display value for Shipping/Freight (billed or estimated)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_usd NUMERIC(10,2);
COMMENT ON COLUMN orders.shipping_usd IS '显示的 Shipping USD（已出账时使用 billed，未出账时估算）';

-- fulfillment_usd: Fulfillment fee in USD (always same)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_usd NUMERIC(10,2);
COMMENT ON COLUMN orders.fulfillment_usd IS 'Fulfillment 费用 USD（始终以 USD 存储）';

-- billing_date: Billing date (only synced when bill_issued = true)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_date DATE;
COMMENT ON COLUMN orders.billing_date IS '账单日期（仅在 bill_issued = true 时同步）';

-- total_cost_usd: Total cost (already exists, but update comment)
COMMENT ON COLUMN orders.total_cost_usd IS '总成本 USD（cog_usd + shipping_usd + fulfillment_usd，自动同步）';

-- =====================================================
-- Step 2: Create sync function
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

COMMENT ON FUNCTION sync_billing_to_orders IS '自动同步 order_billing 的显示字段到 orders 表';

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
-- Step 4: Backfill existing data (optional)
-- =====================================================

-- If there are existing order_billing records, sync them to orders
DO $$
DECLARE
    synced_count INTEGER;
BEGIN
    -- Trigger will automatically handle this, but we can force a refresh
    -- by updating all existing records
    UPDATE order_billing SET updated_at = NOW() WHERE updated_at IS NOT NULL;
    
    SELECT COUNT(*) INTO synced_count FROM order_billing;
    
    RAISE NOTICE '✓ Sync trigger created successfully';
    RAISE NOTICE '✓ Existing % billing records will be synced to orders table', synced_count;
END $$;

-- =====================================================
-- Verification
-- =====================================================

-- Check if columns exist
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    -- Check cog_usd
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'cog_usd'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column cog_usd not found in orders table!';
    END IF;
    
    -- Check shipping_usd
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'shipping_usd'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column shipping_usd not found in orders table!';
    END IF;
    
    -- Check fulfillment_usd
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'fulfillment_usd'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column fulfillment_usd not found in orders table!';
    END IF;
    
    -- Check billing_date
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'billing_date'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column billing_date not found in orders table!';
    END IF;
    
    -- Check trigger exists
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_sync_billing_to_orders'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Trigger trigger_sync_billing_to_orders not found!';
    END IF;
    
    RAISE NOTICE '✓ All display columns verified';
    RAISE NOTICE '✓ Sync trigger verified';
END $$;
