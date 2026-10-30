import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Step 1: Get transaction_ids from order_shipment where shipment_status = 'returned'
  const { data: returnedShipments, error: shipmentsError } = await supabase
    .from('order_shipment')
    .select('transaction_id')
    .eq('shipment_status', 'returned')

  if (shipmentsError) {
    return Response.json({ error: shipmentsError.message }, { status: 500 })
  }

  if (!returnedShipments || returnedShipments.length === 0) {
    return Response.json({ data: [], total: 0, page, pageSize })
  }

  const returnedTransactionIds = [...new Set(returnedShipments.map(s => s.transaction_id))]

  // Step 2: Get total count of orders with order_status = 'shipped' and in returned shipments
  const { count, error: countError } = await supabase
    .from('orders')
    .select('transaction_id', { count: 'exact', head: true })
    .eq('order_status', 'shipped')
    .in('transaction_id', returnedTransactionIds)

  if (countError) {
    return Response.json({ error: countError.message }, { status: 500 })
  }

  // Step 3: Query orders with pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('transaction_id, order_number, dispatch_date, order_status, store_name')
    .eq('order_status', 'shipped')
    .in('transaction_id', returnedTransactionIds)
    .order('dispatch_date', { ascending: true })
    .range(from, to)

  if (ordersError) {
    return Response.json({ error: ordersError.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return Response.json({ data: [], total: count || 0, page, pageSize })
  }

  // Step 4: Query order_shipment for these transaction_ids to get tracking info
  const transactionIds = orders.map(o => o.transaction_id)
  const { data: shipments, error: shipmentsError2 } = await supabase
    .from('order_shipment')
    .select('transaction_id, tracking_no, dest_tracking, shipment_status')
    .in('transaction_id', transactionIds)

  if (shipmentsError2) {
    return Response.json({ error: shipmentsError2.message }, { status: 500 })
  }

  // Build a map of transaction_id to shipments
  const shipmentMap = new Map<string, Array<{ tracking_no: string | null; dest_tracking: string | null; shipment_status: string | null }>>()
  for (const shipment of shipments || []) {
    const tid = shipment.transaction_id
    if (!shipmentMap.has(tid)) {
      shipmentMap.set(tid, [])
    }
    shipmentMap.get(tid)!.push({
      tracking_no: shipment.tracking_no,
      dest_tracking: shipment.dest_tracking,
      shipment_status: shipment.shipment_status,
    })
  }

  // Build results
  const results = orders.map(order => {
    const ships = shipmentMap.get(order.transaction_id) || []
    const returnedShip = ships.find(s => s.shipment_status === 'returned')
    return {
      transaction_id: order.transaction_id,
      order_number: order.order_number,
      dispatch_date: order.dispatch_date,
      order_status: order.order_status,
      store_name: order.store_name,
      tracking_no: returnedShip?.tracking_no || ships[0]?.tracking_no || null,
      dest_tracking: returnedShip?.dest_tracking || ships[0]?.dest_tracking || null,
      shipment_status: 'returned',
    }
  })

  return Response.json({ data: results, total: count || 0, page, pageSize })
}
