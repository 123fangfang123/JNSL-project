-- Create customer_user join table
CREATE TABLE IF NOT EXISTS customer_user (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (customer_id, auth_user_id)
);

-- Migrate existing auth_user_id from customers table
INSERT INTO customer_user (customer_id, auth_user_id)
SELECT customer_id, auth_user_id
FROM customers
WHERE auth_user_id IS NOT NULL;

-- Drop dependent RLS policies
DROP POLICY IF EXISTS customers_read_own ON customers;
DROP POLICY IF EXISTS customer_store_read_own ON customer_store;
DROP POLICY IF EXISTS customer_stock_read_own ON customer_stock;
DROP POLICY IF EXISTS amount_received_read_own ON amount_received;
DROP POLICY IF EXISTS orders_read_own ON orders;
DROP POLICY IF EXISTS order_items_read_own ON order_items;
DROP POLICY IF EXISTS order_shipment_read_own ON order_shipment;
DROP POLICY IF EXISTS packaging_po_read_own ON packaging_po;

-- Drop the old column
ALTER TABLE customers DROP COLUMN IF EXISTS auth_user_id;

-- Recreate RLS policies using customer_user join table
CREATE POLICY customers_read_own ON customers
  FOR SELECT TO public
  USING (is_admin() OR (customer_id IN (SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid())));

CREATE POLICY customer_store_read_own ON customer_store
  FOR SELECT TO public
  USING (is_admin() OR (customer_id IN (SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid())));

CREATE POLICY customer_stock_read_own ON customer_stock
  FOR SELECT TO public
  USING (is_admin() OR (customer_id IN (SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid())));

CREATE POLICY amount_received_read_own ON amount_received
  FOR SELECT TO public
  USING (is_admin() OR (customer_id IN (SELECT customer_id FROM customer_user WHERE auth_user_id = auth.uid())));

CREATE POLICY orders_read_own ON orders
  FOR SELECT TO public
  USING (is_admin() OR (store_name IN (
    SELECT cs.store_name FROM customer_store cs
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

CREATE POLICY order_items_read_own ON order_items
  FOR SELECT TO public
  USING (is_admin() OR (transaction_id IN (
    SELECT o.transaction_id FROM orders o
    JOIN customer_store cs ON o.store_name = cs.store_name
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

CREATE POLICY order_shipment_read_own ON order_shipment
  FOR SELECT TO public
  USING (is_admin() OR (transaction_id IN (
    SELECT o.transaction_id FROM orders o
    JOIN customer_store cs ON o.store_name = cs.store_name
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));

CREATE POLICY packaging_po_read_own ON packaging_po
  FOR SELECT TO public
  USING (is_admin() OR (store_name IN (
    SELECT cs.store_name FROM customer_store cs
    JOIN customer_user cu ON cs.customer_id = cu.customer_id
    WHERE cu.auth_user_id = auth.uid()
  )));
