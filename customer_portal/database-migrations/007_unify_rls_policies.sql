-- ============================================================
-- RLS 策略统一更新脚本
-- 日期: 2026-11-02
-- 说明: 将所有表的 RLS 策略统一为 is_admin() 模式，
--       清理旧策略残留，补齐缺失表的策略
-- ============================================================

-- ============================================================
-- 1. user_roles — 启用 RLS，仅管理员可访问
-- ============================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_admin ON user_roles;
DROP POLICY IF EXISTS user_roles_admin_all ON user_roles;

CREATE POLICY user_roles_admin_all ON user_roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 2. customer_user — 启用 RLS，管理员全权限，客户只读自己的映射
-- ============================================================
ALTER TABLE customer_user ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_user_admin_all ON customer_user;
DROP POLICY IF EXISTS customer_user_read_own ON customer_user;

CREATE POLICY customer_user_admin_all ON customer_user
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY customer_user_read_own ON customer_user
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ============================================================
-- 3. freight — 启用 RLS，仅管理员可访问
-- ============================================================
ALTER TABLE freight ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS freight_admin ON freight;
DROP POLICY IF EXISTS freight_admin_all ON freight;

CREATE POLICY freight_admin_all ON freight
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 4. sku — 启用 RLS，管理员全权限，客户只读自己库存关联的 SKU
-- ============================================================
ALTER TABLE sku ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sku_admin ON sku;
DROP POLICY IF EXISTS sku_admin_all ON sku;
DROP POLICY IF EXISTS sku_read ON sku;
DROP POLICY IF EXISTS sku_customer_read ON sku;

CREATE POLICY sku_admin_all ON sku
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY sku_customer_read ON sku
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin() OR
    sku IN (
      SELECT cs.sku FROM customer_stock cs
      JOIN customer_user cu ON cs.customer_id = cu.customer_id
      WHERE cu.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. exchange_rate — 启用 RLS，仅管理员可访问
-- ============================================================
ALTER TABLE exchange_rate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchange_rate_admin ON exchange_rate;
DROP POLICY IF EXISTS exchange_rate_admin_all ON exchange_rate;
DROP POLICY IF EXISTS exchange_rate_read ON exchange_rate;

CREATE POLICY exchange_rate_admin_all ON exchange_rate
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 6. order_billing — 统一为 is_admin() 模式
-- ============================================================
DROP POLICY IF EXISTS order_billing_admin_all ON order_billing;

CREATE POLICY order_billing_admin_all ON order_billing
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 7. system_config — 统一为 is_admin() 模式
-- ============================================================
DROP POLICY IF EXISTS system_config_admin_all ON system_config;

CREATE POLICY system_config_admin_all ON system_config
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 验证：查看最终策略
-- ============================================================
SELECT tablename, policyname, cmd, roles,
       LEFT(qual, 60) AS qual_preview,
       LEFT(with_check, 60) AS check_preview
FROM pg_policies
WHERE tablename IN (
  'user_roles', 'customer_user', 'freight',
  'sku', 'exchange_rate', 'order_billing', 'system_config'
)
ORDER BY tablename, policyname;
