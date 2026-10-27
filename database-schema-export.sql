-- =====================================================
-- JNSL Customer Portal - Complete Database Schema
-- =====================================================
-- Generated: 2026-10-27
-- Description: Full database structure including tables,
--   views, functions, triggers, enums, and RLS policies.
--   No data is included - structure only.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================

DO $$ BEGIN
  CREATE TYPE order_status_enum AS ENUM ('received', 'processed', 'shipped', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE shipment_status_enum AS ENUM ('created', 'shipped', 'cancelled', 'delivered');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE carrier_enum AS ENUM ('YUNExpress', 'YANWEN', 'HH EXPRESS', 'XJ LOGISTICS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE abnormal_code_enum AS ENUM (
    'customer_request', 'amend_info', 'damaged', 'wrong_item',
    'missing_item', 'package_lost', 'change_shipping', 'shopify_error', 'defective'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. TABLES
-- =====================================================

-- 2.1 customers
CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  name TEXT,
  contact TEXT,
  country TEXT,
  deposit_amt NUMERIC(12,2),
  fulfillment_rate NUMERIC(10,2) DEFAULT 2,
  default_ex_rate NUMERIC(10,4) DEFAULT 6.6,
  default_shipping_rate NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE customers IS '客户主数据表';

-- 2.2 customer_store
CREATE TABLE IF NOT EXISTS customer_store (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, store_name)
);
COMMENT ON TABLE customer_store IS '客户店铺关联表';

-- 2.3 customer_user
CREATE TABLE IF NOT EXISTS customer_user (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, auth_user_id)
);
COMMENT ON TABLE customer_user IS '客户与认证用户关联表（多对多）';

-- 2.4 customer_stock
CREATE TABLE IF NOT EXISTS customer_stock (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  qty NUMERIC DEFAULT 0,
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, sku)
);
COMMENT ON TABLE customer_stock IS '客户库存表';

-- 2.5 sku
CREATE TABLE IF NOT EXISTS sku (
  sku TEXT PRIMARY KEY,
  sku_name TEXT,
  cny_price NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE sku IS 'SKU 主数据表';

-- 2.6 orders
CREATE TABLE IF NOT EXISTS orders (
  transaction_id TEXT PRIMARY KEY,
  order_number INTEGER,
  store_name TEXT,
  order_date DATE,
  dispatch_date DATE,
  shipment_date DATE,
  order_status order_status_enum,
  country TEXT,
  post_code TEXT,
  is_abnormal BOOLEAN DEFAULT false,
  abnormal_code abnormal_code_enum,
  remarks TEXT,
  is_return BOOLEAN DEFAULT false,
  return_qty NUMERIC,
  return_sign_date DATE,
  cancel_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE orders IS '订单主表（基本信息）';

-- 2.7 order_pricing
CREATE TABLE IF NOT EXISTS order_pricing (
  transaction_id TEXT PRIMARY KEY REFERENCES orders(transaction_id) ON DELETE CASCADE,
  order_cny_value NUMERIC(14,4),
  order_ex_rate NUMERIC(10,4),
  currency TEXT DEFAULT 'USD',
  cog_usd NUMERIC(10,2),
  shipping_usd NUMERIC(10,2),
  fulfillment_usd NUMERIC(10,2),
  total_cost_usd NUMERIC(10,2),
  ex_rate_used NUMERIC(10,4),
  billing_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE order_pricing IS '订单价格信息表（从 orders 拆分）';

-- 2.8 order_items
CREATE TABLE IF NOT EXISTS order_items (
  transaction_id TEXT NOT NULL REFERENCES orders(transaction_id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_name TEXT,
  qty NUMERIC DEFAULT 0,
  item_id TEXT,
  sku_standard_price NUMERIC(10,2),
  platform_product_title TEXT,
  sku_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (transaction_id, sku)
);
COMMENT ON TABLE order_items IS '订单商品明细表';

-- 2.9 order_shipment
CREATE TABLE IF NOT EXISTS order_shipment (
  transaction_id TEXT REFERENCES orders(transaction_id) ON DELETE CASCADE,
  tracking_no TEXT PRIMARY KEY,
  carrier carrier_enum,
  channel_id TEXT,
  dispatch_date DATE,
  shipment_status shipment_status_enum DEFAULT 'created',
  dest_tracking TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE order_shipment IS '订单运单跟踪表';

-- 2.10 order_billing
CREATE TABLE IF NOT EXISTS order_billing (
  transaction_id TEXT PRIMARY KEY REFERENCES orders(transaction_id) ON DELETE CASCADE,
  cog_cny NUMERIC(12,2),
  cog_premium_cny NUMERIC(12,2) DEFAULT 0,
  freight_est_cny NUMERIC(12,2),
  cog_billed_usd NUMERIC(10,2),
  freight_billed_usd NUMERIC(10,2),
  fulfillment_usd NUMERIC(10,2),
  total_cost_usd NUMERIC(10,2),
  ex_rate_used NUMERIC(10,4),
  billing_date DATE,
  bill_issued BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE order_billing IS '订单账单信息表';

-- 2.11 freight
CREATE TABLE IF NOT EXISTS freight (
  tracking_no TEXT PRIMARY KEY,
  billing_date DATE,
  weight_g NUMERIC,
  freight NUMERIC(12,2),
  freight_fee NUMERIC(12,2),
  registered_fee NUMERIC(12,2),
  other_fee NUMERIC(12,2),
  duty NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE freight IS '运费账单表';

-- 2.12 packaging_po
CREATE TABLE IF NOT EXISTS packaging_po (
  po_date DATE NOT NULL,
  sku TEXT NOT NULL,
  packaging_name TEXT,
  qty NUMERIC,
  unit_price_cny NUMERIC(12,2),
  total_cost_cny NUMERIC(12,2),
  exchange_rate_used NUMERIC(10,4),
  billing_date DATE,
  usd_amt NUMERIC(10,2),
  remarks TEXT,
  store_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (po_date, sku)
);
COMMENT ON TABLE packaging_po IS '包装采购订单表';

-- 2.13 amount_received
CREATE TABLE IF NOT EXISTS amount_received (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE CASCADE,
  date_received DATE,
  amount_transferred NUMERIC(12,2),
  amount_received NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE amount_received IS '客户充值记录表';

-- 2.14 exchange_rate
CREATE TABLE IF NOT EXISTS exchange_rate (
  transaction_date DATE PRIMARY KEY,
  exchange_rate NUMERIC(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE exchange_rate IS '每日汇率表';

-- 2.15 user_roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE user_roles IS '用户角色表（admin/customer）';

-- 2.16 system_config
CREATE TABLE IF NOT EXISTS system_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE system_config IS '系统配置表';

-- Insert default exchange rate config
INSERT INTO system_config (config_key, config_value, description)
VALUES ('default_exchange_rate', '6.75', 'Default USD/CNY exchange rate when ex_rate_used is NULL')
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customer_store_customer_id ON customer_store(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_store_store_name ON customer_store(store_name);
CREATE INDEX IF NOT EXISTS idx_customer_user_customer_id ON customer_user(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_user_auth_user_id ON customer_user(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_stock_customer_id ON customer_stock(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_stock_sku ON customer_stock(sku);
CREATE INDEX IF NOT EXISTS idx_orders_store_name ON orders(store_name);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_is_abnormal ON orders(is_abnormal);
CREATE INDEX IF NOT EXISTS idx_order_pricing_transaction_id ON order_pricing(transaction_id);
CREATE INDEX IF NOT EXISTS idx_order_pricing_currency ON order_pricing(currency);
CREATE INDEX IF NOT EXISTS idx_order_items_transaction_id ON order_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
CREATE INDEX IF NOT EXISTS idx_order_shipment_transaction_id ON order_shipment(transaction_id);
CREATE INDEX IF NOT EXISTS idx_order_shipment_tracking_no ON order_shipment(tracking_no);
CREATE INDEX IF NOT EXISTS idx_order_shipment_carrier ON order_shipment(carrier);
CREATE INDEX IF NOT EXISTS idx_order_billing_transaction_id ON order_billing(transaction_id);
CREATE INDEX IF NOT EXISTS idx_order_billing_bill_issued ON order_billing(bill_issued);
CREATE INDEX IF NOT EXISTS idx_order_billing_billing_date ON order_billing(billing_date);
CREATE INDEX IF NOT EXISTS idx_freight_tracking_no ON freight(tracking_no);
CREATE INDEX IF NOT EXISTS idx_freight_billing_date ON freight(billing_date);
CREATE INDEX IF NOT EXISTS idx_packaging_po_po_date ON packaging_po(po_date);
CREATE INDEX IF NOT EXISTS idx_packaging_po_sku ON packaging_po(sku);
CREATE INDEX IF NOT EXISTS idx_amount_received_customer_id ON amount_received(customer_id);
CREATE INDEX IF NOT EXISTS idx_amount_received_date_received ON amount_received(date_received);

-- =====================================================
-- 4. FUNCTIONS
-- =====================================================

-- 4.1 is_admin() helper function for RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
COMMENT ON FUNCTION is_admin() IS '检查当前用户是否为管理员';

-- 4.2 get_default_exchange_rate()
CREATE OR REPLACE FUNCTION get_default_exchange_rate()
RETURNS NUMERIC(10,4) AS $$
DECLARE
  default_rate NUMERIC(10,4);
BEGIN
  SELECT COALESCE(AVG(ex_rate_used), 6.75) INTO default_rate
  FROM order_pricing
  WHERE ex_rate_used IS NOT NULL;
  RETURN ROUND(default_rate, 4);
END;
$$ LANGUAGE plpgsql STABLE;
COMMENT ON FUNCTION get_default_exchange_rate() IS '获取默认汇率，基于历史 order_pricing 中账单汇率的平均值';

-- 4.3 update_bill_issued_status()
CREATE OR REPLACE FUNCTION update_bill_issued_status(p_transaction_id TEXT, p_bill_issued BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE order_billing
  SET bill_issued = p_bill_issued, updated_at = NOW()
  WHERE transaction_id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order billing record not found for transaction_id: %', p_transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION update_bill_issued_status IS '手动更新订单的 bill_issued 状态';

-- 4.4 batch_update_bill_issued()
CREATE OR REPLACE FUNCTION batch_update_bill_issued(p_transaction_ids TEXT[], p_bill_issued BOOLEAN)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE order_billing
  SET bill_issued = p_bill_issued, updated_at = NOW()
  WHERE transaction_id = ANY(p_transaction_ids);
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION batch_update_bill_issued IS '批量更新多个订单的 bill_issued 状态';

-- 4.5 sync_billing_to_orders() trigger function
CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE order_pricing op
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
    ex_rate_used = COALESCE(
      NEW.ex_rate_used,
      (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
      get_default_exchange_rate(),
      6.75
    ),
    updated_at = NOW()
  WHERE op.transaction_id = NEW.transaction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION sync_billing_to_orders IS '自动同步 order_billing 的显示字段到 order_pricing 表';

-- 4.6 bulk_update_shipments()
CREATE OR REPLACE FUNCTION bulk_update_shipments(p_data JSON)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_item JSON;
BEGIN
  FOR v_item IN SELECT * FROM json_array_elements(p_data) LOOP
    UPDATE order_shipment
    SET
      shipment_status = COALESCE((v_item->>'shipment_status')::TEXT, shipment_status),
      dest_tracking = COALESCE(v_item->>'dest_tracking', dest_tracking),
      updated_at = NOW()
    WHERE tracking_no = v_item->>'tracking_no';
    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  RETURN v_updated;
END;
$$;
COMMENT ON FUNCTION bulk_update_shipments(JSON) IS 'Batch update order_shipment via JSON array input';

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS trigger_sync_billing_to_orders ON order_billing;
CREATE TRIGGER trigger_sync_billing_to_orders
AFTER INSERT OR UPDATE ON order_billing
FOR EACH ROW
EXECUTE FUNCTION sync_billing_to_orders();
COMMENT ON TRIGGER trigger_sync_billing_to_orders ON order_billing IS '当 order_billing 更新时，自动同步显示字段到 order_pricing 表';

-- =====================================================
-- 6. VIEWS
-- =====================================================

-- 6.1 orders_with_billing_display
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

-- 6.2 order_billing_calc_view
CREATE OR REPLACE VIEW order_billing_calc_view AS
SELECT
  o.transaction_id,
  COALESCE(SUM(s.cny_price * oi.qty), 0) as cog_cny,
  0 as cog_premium_cny,
  COALESCE(
    (SELECT c.default_shipping_rate
     FROM customer_store cs
     JOIN customers c ON cs.customer_id = c.customer_id
     WHERE cs.store_name = o.store_name
     LIMIT 1),
    0
  ) * (
    SELECT config_value::numeric
    FROM system_config
    WHERE config_key = 'default_exchange_rate'
    LIMIT 1
  ) as freight_est_cny,
  COALESCE(
    (SELECT c.fulfillment_rate
     FROM customer_store cs
     JOIN customers c ON cs.customer_id = c.customer_id
     WHERE cs.store_name = o.store_name
     LIMIT 1),
    0
  ) as fulfillment_usd
FROM orders o
LEFT JOIN order_items oi ON o.transaction_id = oi.transaction_id
LEFT JOIN sku s ON oi.sku = s.sku
GROUP BY o.transaction_id, o.store_name;
COMMENT ON VIEW order_billing_calc_view IS '订单计费数据动态计算视图';

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- 7.1 Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_shipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_po ENABLE ROW LEVEL SECURITY;
ALTER TABLE amount_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 7.2 customers - Admin sees all; customer sees own
DROP POLICY IF EXISTS customers_admin_all ON customers;
CREATE POLICY customers_admin_all ON customers
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS customers_read_own ON customers;
CREATE POLICY customers_read_own ON customers
  FOR SELECT TO authenticated
  USING (is_admin() OR (customer_id IN (
    SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid()
  )));

-- 7.3 customer_store
DROP POLICY IF EXISTS customer_store_admin_all ON customer_store;
CREATE POLICY customer_store_admin_all ON customer_store
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS customer_store_read_own ON customer_store;
CREATE POLICY customer_store_read_own ON customer_store
  FOR SELECT TO authenticated
  USING (is_admin() OR (customer_id IN (
    SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid()
  )));

-- 7.4 customer_stock
DROP POLICY IF EXISTS customer_stock_admin_all ON customer_stock;
CREATE POLICY customer_stock_admin_all ON customer_stock
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS customer_stock_read_own ON customer_stock;
CREATE POLICY customer_stock_read_own ON customer_stock
  FOR SELECT TO authenticated
  USING (is_admin() OR (customer_id IN (
    SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid()
  )));

-- 7.5 amount_received
DROP POLICY IF EXISTS amount_received_admin_all ON amount_received;
CREATE POLICY amount_received_admin_all ON amount_received
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS amount_received_read_own ON amount_received;
CREATE POLICY amount_received_read_own ON amount_received
  FOR SELECT TO authenticated
  USING (is_admin() OR (customer_id IN (
    SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid()
  )));

-- 7.6 orders
DROP POLICY IF EXISTS orders_admin_all ON orders;
CREATE POLICY orders_admin_all ON orders
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS orders_read_own ON orders;
CREATE POLICY orders_read_own ON orders
  FOR SELECT TO authenticated
  USING (is_admin() OR (store_name IN (
    SELECT cs.store_name FROM customer_store cs
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

-- 7.7 order_pricing (follows orders access)
DROP POLICY IF EXISTS order_pricing_admin_all ON order_pricing;
CREATE POLICY order_pricing_admin_all ON order_pricing
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS order_pricing_read_own ON order_pricing;
CREATE POLICY order_pricing_read_own ON order_pricing
  FOR SELECT TO authenticated
  USING (is_admin() OR (transaction_id IN (
    SELECT o.transaction_id FROM orders o
    JOIN customer_store cs ON o.store_name = cs.store_name
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

-- 7.8 order_items
DROP POLICY IF EXISTS order_items_admin_all ON order_items;
CREATE POLICY order_items_admin_all ON order_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS order_items_read_own ON order_items;
CREATE POLICY order_items_read_own ON order_items
  FOR SELECT TO authenticated
  USING (is_admin() OR (transaction_id IN (
    SELECT o.transaction_id FROM orders o
    JOIN customer_store cs ON o.store_name = cs.store_name
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

-- 7.9 order_shipment
DROP POLICY IF EXISTS order_shipment_admin_all ON order_shipment;
CREATE POLICY order_shipment_admin_all ON order_shipment
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS order_shipment_read_own ON order_shipment;
CREATE POLICY order_shipment_read_own ON order_shipment
  FOR SELECT TO authenticated
  USING (is_admin() OR (transaction_id IN (
    SELECT o.transaction_id FROM orders o
    JOIN customer_store cs ON o.store_name = cs.store_name
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

-- 7.10 packaging_po
DROP POLICY IF EXISTS packaging_po_admin_all ON packaging_po;
CREATE POLICY packaging_po_admin_all ON packaging_po
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS packaging_po_read_own ON packaging_po;
CREATE POLICY packaging_po_read_own ON packaging_po
  FOR SELECT TO authenticated
  USING (is_admin() OR (store_name IN (
    SELECT cs.store_name FROM customer_store cs
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

-- 7.11 order_billing - Admin only
DROP POLICY IF EXISTS order_billing_admin_all ON order_billing;
CREATE POLICY order_billing_admin_all ON order_billing
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 7.12 freight - Admin only
DROP POLICY IF EXISTS freight_admin_all ON freight;
CREATE POLICY freight_admin_all ON freight
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 7.13 sku - Admin full access, authenticated read
DROP POLICY IF EXISTS sku_admin_all ON sku;
CREATE POLICY sku_admin_all ON sku
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS sku_read ON sku;
CREATE POLICY sku_read ON sku
  FOR SELECT TO authenticated
  USING (true);

-- 7.14 exchange_rate - Admin full access, authenticated read
DROP POLICY IF EXISTS exchange_rate_admin_all ON exchange_rate;
CREATE POLICY exchange_rate_admin_all ON exchange_rate
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS exchange_rate_read ON exchange_rate;
CREATE POLICY exchange_rate_read ON exchange_rate
  FOR SELECT TO authenticated
  USING (true);

-- 7.15 user_roles - Admin only
DROP POLICY IF EXISTS user_roles_admin_all ON user_roles;
CREATE POLICY user_roles_admin_all ON user_roles
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS user_roles_read_own ON user_roles;
CREATE POLICY user_roles_read_own ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 7.16 system_config - Admin only
DROP POLICY IF EXISTS system_config_admin_all ON system_config;
CREATE POLICY system_config_admin_all ON system_config
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 7.17 customer_user - Admin full access, customer read own
DROP POLICY IF EXISTS customer_user_admin_all ON customer_user;
CREATE POLICY customer_user_admin_all ON customer_user
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS customer_user_read_own ON customer_user;
CREATE POLICY customer_user_read_own ON customer_user
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- =====================================================
-- 8. GRANTS (optional, adjust as needed)
-- =====================================================

GRANT SELECT ON orders_with_billing_display TO authenticated;
GRANT SELECT ON order_billing_calc_view TO authenticated;

COMMIT;
