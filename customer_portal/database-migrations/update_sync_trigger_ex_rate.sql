-- =====================================================
-- Update Billing Display Fields Sync Trigger
-- Date: 2026-08-10
-- Description: 
--   Updates the sync_billing_to_orders() function to include
--   ex_rate_used field synchronization with fallback logic
--   
-- Prerequisites:
--   1. orders table must already have these columns:
--      - cog_usd NUMERIC(10,2)
--      - shipping_usd NUMERIC(10,2)
--      - fulfillment_usd NUMERIC(10,2)
--      - billing_date DATE
--      - ex_rate_used NUMERIC(10,4)
--      - total_cost_usd NUMERIC(10,2)
--   2. order_billing table must exist
--   3. system_config table must exist with default_exchange_rate
--   4. get_default_exchange_rate() function must exist
--
-- Note: This script ONLY updates the trigger function.
--       It does NOT add any columns to orders table.
-- =====================================================

-- =====================================================
-- Step 1: Update sync function to include ex_rate_used
-- =====================================================

CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders o
    SET 
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
        
        fulfillment_usd = NEW.fulfillment_usd,
        
        ex_rate_used = COALESCE(
            NEW.ex_rate_used,
            (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
            get_default_exchange_rate(),
            6.75
        ),
        
        billing_date = CASE 
            WHEN NEW.bill_issued = true THEN NEW.billing_date
            ELSE NULL
        END,
        
        total_cost_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.total_cost_usd
            WHEN NEW.cog_cny IS NOT NULL THEN
                ROUND(
                    ((NEW.cog_cny + COALESCE(NEW.cog_premium_cny, 0)) / 
                     COALESCE(
                         NEW.ex_rate_used,
                         (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                         get_default_exchange_rate(),
                         6.75
                     )) +
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
                    COALESCE(NEW.fulfillment_usd, 0),
                2)
            ELSE NULL
        END,
        
        updated_at = NOW()
    WHERE o.transaction_id = NEW.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_billing_to_orders IS '自动同步 order_billing 的显示字段到 orders 表（包含 ex_rate_used）';

-- =====================================================
-- Step 2: Recreate trigger
-- =====================================================

DROP TRIGGER IF EXISTS trigger_sync_billing_to_orders ON order_billing;

CREATE TRIGGER trigger_sync_billing_to_orders
AFTER INSERT OR UPDATE ON order_billing
FOR EACH ROW
EXECUTE FUNCTION sync_billing_to_orders();

COMMENT ON TRIGGER trigger_sync_billing_to_orders ON order_billing IS '当 order_billing 更新时，自动同步显示字段到 orders 表';

-- =====================================================
-- Step 3: Verification
-- =====================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'ex_rate_used'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'Column ex_rate_used not found in orders table!';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_sync_billing_to_orders'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        RAISE EXCEPTION 'Trigger not found!';
    END IF;
    
    RAISE NOTICE 'Success: Trigger updated with ex_rate_used support';
END $$;
