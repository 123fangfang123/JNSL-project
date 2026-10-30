-- Fix: order_number column exceeds integer max (2,147,483,647)
-- Change from integer to bigint to support larger order numbers like 9841231010

-- Step 1: Drop dependent view
DROP VIEW IF EXISTS orders_with_billing_display;

-- Step 2: Alter column type
ALTER TABLE orders ALTER COLUMN order_number TYPE BIGINT USING order_number::BIGINT;

-- Step 3: Recreate view
CREATE OR REPLACE VIEW orders_with_billing_display AS
SELECT
    o.transaction_id,
    o.order_number,
    o.store_name,
    o.order_date,
    o.dispatch_date,
    o.order_status,
    o.country,
    o.abnormal_code,
    o.remarks,
    o.is_abnormal,
    op.order_cny_value,
    op.order_ex_rate,
    op.currency,
    op.billing_date,
    ob.bill_issued,
    op.ex_rate_used,
    COALESCE(
        op.ex_rate_used,
        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
        get_default_exchange_rate(),
        6.75
    ) as effective_ex_rate,
    op.cog_usd,
    op.shipping_usd,
    op.fulfillment_usd,
    op.total_cost_usd
FROM orders o
LEFT JOIN order_pricing op ON o.transaction_id = op.transaction_id
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id;

COMMENT ON VIEW orders_with_billing_display IS '订单显示视图，关联 order_pricing 获取价格数据，关联 order_billing 获取账单状态';
