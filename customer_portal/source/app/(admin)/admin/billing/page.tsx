import { createServiceClient } from '@/lib/supabase/service'
import { BillingPageClient } from './BillingPageClient'

interface PageProps {
  searchParams: Promise<{
    from?: string
    to?: string
    store?: string
    status?: string
    billed?: string
  }>
}

export default async function BillingPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = createServiceClient()
  
  let query = supabase
    .from('orders')
    .select('transaction_id, store_name, order_date, dispatch_date, order_status, billing_date, cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, ex_rate_used, order_cny_value, order_ex_rate')
  
  // Apply filters
  if (params.from) {
    query = query.gte('order_date', params.from)
  }
  if (params.to) {
    query = query.lte('order_date', params.to + 'T23:59:59')
  }
  if (params.store) {
    query = query.eq('store_name', params.store)
  }
  if (params.status) {
    query = query.eq('order_status', params.status)
  }
  // Only filter for unbilled orders when billed=false or not specified
  if (!params.billed || params.billed === 'false') {
    query = query.is('billing_date', null)
  }
  
  query = query.order('order_date', { ascending: true })
  
  const { data: orders } = await query
  
  // Get tracking numbers from order_shipment
  const transactionIds = (orders ?? []).map(o => o.transaction_id)
  let trackingMap = new Map<string, string>()
  
  if (transactionIds.length > 0) {
    const { data: shipments } = await supabase
      .from('order_shipment')
      .select('transaction_id, tracking_no')
      .in('transaction_id', transactionIds)
    
    if (shipments) {
      shipments.forEach(s => {
        trackingMap.set(s.transaction_id, s.tracking_no)
      })
    }
  }
  
  // Add tracking_no to orders
  const ordersWithTracking = (orders ?? []).map(order => ({
    ...order,
    tracking_no: trackingMap.get(order.transaction_id) || null
  }))
  
  // Get unique stores for filter dropdown (all orders, not just unbilled)
  const { data: allOrders } = await supabase
    .from('orders')
    .select('store_name')
  
  const stores = [...new Set((allOrders ?? []).map(o => o.store_name).filter(Boolean))] as string[]
  
  return <BillingPageClient unbilledOrders={ordersWithTracking} stores={stores} />
}
