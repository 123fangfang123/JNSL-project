-- Fix: transaction_id contains both numeric (9841231010) and alphanumeric (xo3902) values
-- Change to TEXT type to support all formats
-- Date: 2026-10-28

-- ============================================================
-- Step 1: Drop dependent views
-- ============================================================
DROP VIEW IF EXISTS orders_with_billing_display;
DROP VIEW IF EXISTS order_billing_calc_view;

-- ============================================================
-- Step 2: Drop RLS policies on all affected tables
-- ============================================================
DROP POLICY IF EXISTS order_billing_admin_all ON order_billing;
DROP POLICY IF EXISTS order_items_admin_all ON order_items;
DROP POLICY IF EXISTS order_items_read_own ON order_items;
DROP POLICY IF EXISTS order_pricing_admin_all ON order_pricing;
DROP POLICY IF EXISTS order_pricing_read_own ON order_pricing;
DROP POLICY IF EXISTS order_shipment_admin_all ON order_shipment;
DROP POLICY IF EXISTS order_shipment_read_own ON order_shipment;
DROP POLICY IF EXISTS orders_admin_all ON orders;
DROP POLICY IF EXISTS orders_read_own ON orders;

-- ============================================================
-- Step 3: Drop foreign key constraints referencing transaction_id
-- ============================================================
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'transaction_id'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
            r.table_schema, r.table_name, r.constraint_name);
        RAISE NOTICE 'Dropped FK % on %.%', r.constraint_name, r.table_schema, r.table_name;
    END LOOP;
END $$;

-- ============================================================
-- Step 4: Alter transaction_id to TEXT
-- ============================================================
ALTER TABLE orders ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::TEXT;
ALTER TABLE order_shipment ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::TEXT;
ALTER TABLE order_pricing ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::TEXT;
ALTER TABLE order_items ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::TEXT;
ALTER TABLE order_billing ALTER COLUMN transaction_id TYPE TEXT USING transaction_id::TEXT;

-- ============================================================
-- Step 5: Recreate views
-- ============================================================
CREATE OR REPLACE VIEW order_billing_calc_view AS
SELECT
  o.transaction_id,
  COALESCE(SUM(s.cny_price * oi.qty), 0) as cog_cny,
  0 as cog_premium_cny,
  COALESCE(
    (SELECT c.default_shipping_rate
     FROM customer_store cs
     JOIN customers c ON cs.customer_id = c.customer_id
     WHERE cs.store_name = o.store_name LIMIT 1), 0
  ) * (
    SELECT config_value::numeric FROM system_config
    WHERE config_key = 'default_exchange_rate' LIMIT 1
  ) as freight_est_cny,
  COALESCE(
    (SELECT c.fulfillment_rate
     FROM customer_store cs
     JOIN customers c ON cs.customer_id = c.customer_id
     WHERE cs.store_name = o.store_name LIMIT 1), 0
  ) as fulfillment_usd
FROM orders o
LEFT JOIN order_items oi ON o.transaction_id = oi.transaction_id
LEFT JOIN sku s ON oi.sku = s.sku
GROUP BY o.transaction_id, o.store_name;

COMMENT ON VIEW order_billing_calc_view IS 'Dynamic calculation view for order billing data';

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

-- ============================================================
-- Step 6: Recreate RLS policies
-- ============================================================

-- order_billing
CREATE POLICY order_billing_admin_all ON order_billing
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- order_items
CREATE POLICY order_items_admin_all ON order_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY order_items_read_own ON order_items
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin() OR
    transaction_id IN (
      SELECT o.transaction_id
      FROM orders o
      JOIN customer_store cs ON o.store_name = cs.store_name
      JOIN customer_user cu ON cs.customer_id = cu.customer_id
      WHERE cu.auth_user_id = auth.uid()
    )
  );

-- order_pricing
CREATE POLICY order_pricing_admin_all ON order_pricing
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY order_pricing_read_own ON order_pricing
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin() OR
    transaction_id IN (
      SELECT o.transaction_id
      FROM orders o
      JOIN customer_store cs ON o.store_name = cs.store_name
      JOIN customer_user cu ON cs.customer_id = cu.customer_id
      WHERE cu.auth_user_id = auth.uid()
    )
  );

-- order_shipment
CREATE POLICY order_shipment_admin_all ON order_shipment
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY order_shipment_read_own ON order_shipment
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin() OR
    transaction_id IN (
      SELECT o.transaction_id
      FROM orders o
      JOIN customer_store cs ON o.store_name = cs.store_name
      JOIN customer_user cu ON cs.customer_id = cu.customer_id
      WHERE cu.auth_user_id = auth.uid()
    )
  );

-- orders
CREATE POLICY orders_admin_all ON orders
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY orders_read_own ON orders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin() OR
    store_name IN (
      SELECT cs.store_name
      FROM customer_store cs
      JOIN customer_user cu ON cs.customer_id = cu.customer_id
      WHERE cu.auth_user_id = auth.uid()
    )
  );
