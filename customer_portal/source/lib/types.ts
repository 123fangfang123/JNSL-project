export type OrderStatus = 'received' | 'processed' | 'shipped' | 'cancelled'
export type ShipmentStatus = 'created' | 'shipped' | 'cancelled'
export type Carrier = 'YUNExpress' | 'YANWEN' | 'HH EXPRESS' | 'XJ LOGISTICS'
export type AbnormalCode =
  | 'package_lost' | 'customer_request' | 'amend_info' | 'defective' | 'damaged'
  | 'wrong_item' | 'missing_item' | 'change_shipping' | 'shopify_error'

export interface Order {
  transaction_id: string
  order_number: number
  store_name: string
  order_date: string
  dispatch_date: string | null
  order_status: OrderStatus
  country: string | null
  post_code: string | null
  is_abnormal: boolean
  // abnormal-only fields (null for regular orders)
  abnormal_code: AbnormalCode | null
  remarks: string | null
  is_return: boolean
  return_qty: number | null
  return_sign_date: string | null
  cancel_date: string | null
  // joined from order_shipment
  tracking_no: string | null
  carrier: Carrier | null
  shipment_status: ShipmentStatus | null
  dest_tracking: string | null
}

export interface OrderPricing {
  transaction_id: string
  order_cny_value: number | null
  order_ex_rate: number | null
  currency: string | null
  cog_usd: number | null
  shipping_usd: number | null
  fulfillment_usd: number | null
  total_cost_usd: number | null
  ex_rate_used: number | null
  billing_date: string | null
}

export interface OrderItem {
  item_id: string | null
  sku: string
  product_name: string | null
  qty: number | null
}

export interface PackagingItem {
  po_date: string
  packaging_name: string | null
  qty: number | null
  unit_price_cny: number | null
  total_cost_cny: number | null
  exchange_rate_used: number | null
  billing_date: string | null
  usd_amt: number | null
  remarks: string | null
  store_name: string | null
}

export interface StockItem {
  sku: string
  sku_name: string | null
  qty: number
  unit_price_usd: number | null
  stock_value_usd: number | null
  snapshot_at: string
}

export interface TopupRecord {
  date_received: string
  amount_transferred: number | null
  amount_received: number | null
  difference: number | null
}
