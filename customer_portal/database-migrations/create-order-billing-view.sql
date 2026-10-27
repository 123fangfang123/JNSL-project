-- 创建 order_billing 计算视图
-- 这个视图动态计算每个订单的计费数据

CREATE OR REPLACE VIEW order_billing_calc_view AS
SELECT 
  o.transaction_id,
  -- 计算 cog_cny: 所有商品的 cny_price * qty 之和
  COALESCE(SUM(s.cny_price * oi.qty), 0) as cog_cny,
  -- cog_premium_cny 固定为 0
  0 as cog_premium_cny,
  -- 计算 freight_est_cny: customer.default_shipping_rate * system_config.default_exchange_rate
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
  -- 获取 fulfillment_usd: customer.fulfillment_rate
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

COMMENT ON VIEW order_billing_calc_view IS 'Dynamic calculation view for order billing data';
