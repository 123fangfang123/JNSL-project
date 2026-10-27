-- 查询客户 Atelier-US 的所有订单
SELECT 
  o.order_number,
  o.transaction_id,
  o.store_name,
  o.order_date,
  o.order_status,
  o.country,
  os.tracking_no,
  os.carrier
FROM orders o
LEFT JOIN order_shipment os ON o.transaction_id = os.transaction_id
WHERE o.store_name IN (
  SELECT store_name 
  FROM customer_store 
  WHERE customer_id = (
    SELECT customer_id 
    FROM customers 
    WHERE name = 'Atelier-US'
  )
)
ORDER BY o.order_date DESC, o.order_number DESC;
