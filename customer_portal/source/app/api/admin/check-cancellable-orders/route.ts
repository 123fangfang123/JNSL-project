import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Calculate date 1 month ago
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  const dateStr = oneMonthAgo.toISOString().split('T')[0]

  // Step 1: Get total count
  const { count, error: countError } = await supabase
    .from('orders')
    .select('transaction_id', { count: 'exact', head: true })
    .eq('order_status', 'shipped')
    .lt('dispatch_date', dateStr)

  if (countError) {
    return Response.json({ error: countError.message }, { status: 500 })
  }

  // Step 2: Query orders with pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('transaction_id, order_number, dispatch_date, order_status, store_name')
    .eq('order_status', 'shipped')
    .lt('dispatch_date', dateStr)
    .order('dispatch_date', { ascending: true })
    .range(from, to)

  if (ordersError) {
    return Response.json({ error: ordersError.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return Response.json({ data: [], total: 0, page, pageSize })
  }

  // Step 3: Query order_shipment for these transaction_ids
  const transactionIds = orders.map(o => o.transaction_id)
  const { data: shipments, error: shipmentsError } = await supabase
    .from('order_shipment')
    .select('transaction_id, tracking_no, dest_tracking')
    .in('transaction_id', transactionIds)

  if (shipmentsError) {
    return Response.json({ error: shipmentsError.message }, { status: 500 })
  }

  // Build a map of transaction_id to shipments
  const shipmentMap = new Map<string, Array<{ tracking_no: string | null; dest_tracking: string | null }>>()
  for (const shipment of shipments || []) {
    const tid = shipment.transaction_id
    if (!shipmentMap.has(tid)) {
      shipmentMap.set(tid, [])
    }
    shipmentMap.get(tid)!.push({
      tracking_no: shipment.tracking_no,
      dest_tracking: shipment.dest_tracking,
    })
  }

  // Filter orders where dest_tracking is null or empty
  const results = []
  for (const order of orders) {
    const ships = shipmentMap.get(order.transaction_id)
    if (!ships || ships.length === 0) {
      results.push({
        transaction_id: order.transaction_id,
        order_number: order.order_number,
        dispatch_date: order.dispatch_date,
        order_status: order.order_status,
        store_name: order.store_name,
        tracking_no: null,
        dest_tracking: null,
      })
    } else {
      for (const ship of ships) {
        if (!ship.dest_tracking || ship.dest_tracking === '') {
          results.push({
            transaction_id: order.transaction_id,
            order_number: order.order_number,
            dispatch_date: order.dispatch_date,
            order_status: order.order_status,
            store_name: order.store_name,
            tracking_no: ship.tracking_no,
            dest_tracking: ship.dest_tracking,
          })
          break
        }
      }
    }
  }

  return Response.json({ data: results, total: count || 0, page, pageSize })
}
