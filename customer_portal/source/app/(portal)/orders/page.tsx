import { getPortalContext } from '@/lib/supabase/portal-context'
import { OrdersTable } from '@/components/OrdersTable'
import type { Order } from '@/lib/types'

interface SearchParams {
  from?: string
  to?: string
  store?: string
  q?: string
  status?: string
  product?: string
  isAbnormal?: string
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { supabase, customerId, isAdmin } = await getPortalContext()

  if (isAdmin && !customerId) {
    return <div className="p-8 text-gray-500 text-sm">Select a customer above to view their orders.</div>
  }

  if (!isAdmin && !customerId) {
    return <div className="p-8 text-gray-500 text-sm">No customer account found. Please contact support.</div>
  }

  // Get customer's stores (reuse for both filter and dropdown)
  let storeQuery = supabase.from('customer_store').select('store_name').order('store_name')
  if (customerId) storeQuery = storeQuery.eq('customer_id', customerId)
  const { data: storeRows } = await storeQuery
  const stores = (storeRows ?? []).map(r => r.store_name)

  // Build query with filters applied BEFORE joining order_shipment
  let baseQuery = supabase
    .from('orders_with_billing_display')
    .select(
      `transaction_id, is_abnormal, order_number, store_name, order_date, dispatch_date, billing_date,
       cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, ex_rate_used, order_cny_value, order_ex_rate, order_status, country,
       abnormal_code, remarks`
    )

  // Apply filters first to reduce dataset
  if (customerId && stores.length > 0) {
    baseQuery = baseQuery.in('store_name', stores)
  } else if (customerId && stores.length === 0) {
    return <OrdersTable initialOrders={[]} stores={stores} currentParams={{}} />
  }
  
  if (params.from) baseQuery = baseQuery.gte('order_date', params.from)
  if (params.to) baseQuery = baseQuery.lte('order_date', params.to + 'T23:59:59')
  if (params.store) baseQuery = baseQuery.eq('store_name', params.store)
  if (params.status) baseQuery = baseQuery.eq('order_status', params.status)
  if (params.q && /^\d+$/.test(params.q) && params.q.length <= 10) {
    baseQuery = baseQuery.eq('order_number', parseInt(params.q))
  }
  // Filter by abnormal status
  if (params.isAbnormal === 'true') {
    baseQuery = baseQuery.eq('is_abnormal', true)
  } else if (params.isAbnormal === 'false') {
    baseQuery = baseQuery.eq('is_abnormal', false)
  } else if (params.isAbnormal !== 'all') {
    // Default to normal orders only when no isAbnormal param or invalid value
    baseQuery = baseQuery.eq('is_abnormal', false)
  }
  // If isAbnormal is 'all', no filter is applied - shows all orders

  // Get filtered orders in batches (Supabase server max_rows = 1000)
  const batchSize = 1000
  let allOrderRows: any[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: batchData, error: batchError } = await baseQuery
      .order('order_number', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (batchError) {
      return (
        <div className="p-8 text-red-600 bg-red-50 rounded m-6 border border-red-200">
          Failed to load orders: {batchError.message}
        </div>
      )
    }

    if (batchData && batchData.length > 0) {
      allOrderRows = allOrderRows.concat(batchData)
      offset += batchSize
      if (batchData.length < batchSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }

  const orderRows = allOrderRows

  // Then fetch shipments for these orders only (in batches to avoid URL overflow)
  let rows = orderRows ?? []
  if (rows.length > 0) {
    const transactionIds = rows.map(r => r.transaction_id)
    
    // Split into batches of 100 to avoid URL length limits
    const batchSize = 100
    const batches = []
    for (let i = 0; i < transactionIds.length; i += batchSize) {
      batches.push(transactionIds.slice(i, i + batchSize))
    }
    
    // Query each batch and combine results
    let allShipmentData: any[] = []
    for (const batch of batches) {
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('order_shipment')
        .select('transaction_id, tracking_no, carrier, shipment_status, dest_tracking')
        .in('transaction_id', batch)
      
      if (shipmentError) {
        console.error('Shipment query error for batch:', shipmentError)
      } else if (shipmentData) {
        allShipmentData = allShipmentData.concat(shipmentData)
      }
    }
    
    // Group shipments by transaction_id
    const shipmentMap = new Map<string, any[]>()
    for (const s of allShipmentData) {
      if (!shipmentMap.has(s.transaction_id)) {
        shipmentMap.set(s.transaction_id, [])
      }
      shipmentMap.get(s.transaction_id)!.push(s)
    }
    
    // Attach shipments to orders
    rows = rows.map(order => ({
      ...order,
      order_shipment: shipmentMap.get(order.transaction_id) ?? []
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orders: Order[] = (rows ?? []).map((row: any) => {
    const shipments: any[] = Array.isArray(row.order_shipment)
      ? row.order_shipment
      : row.order_shipment
      ? [row.order_shipment]
      : []

    shipments.sort((a, b) =>
      (b.tracking_no ?? '').localeCompare(a.tracking_no ?? '')
    )
    const s = shipments[0] ?? null

    return {
      transaction_id: row.transaction_id,
      is_abnormal: row.is_abnormal,
      order_number: row.order_number,
      store_name: row.store_name,
      order_date: row.order_date,
      billing_date: row.billing_date,
      cog_usd: row.cog_usd,
      shipping_usd: row.shipping_usd,
      fulfillment_usd: row.fulfillment_usd,
      total_cost_usd: row.total_cost_usd,
      ex_rate_used: row.ex_rate_used,
      order_cny_value: row.order_cny_value ?? null,
      order_ex_rate: row.order_ex_rate ?? null,
      order_status: row.order_status,
      country: row.country,
      abnormal_code: row.abnormal_code ?? null,
      remarks: row.remarks ?? null,
      tracking_no: s?.tracking_no ?? null,
      carrier: s?.carrier ?? null,
      dispatch_date: row.dispatch_date ?? null,
      shipment_status: s?.shipment_status ?? null,
      dest_tracking: s?.dest_tracking ?? null,
    } satisfies Order
  })

  if (params.q && !/^\d+$/.test(params.q)) {
    const lq = params.q.toLowerCase()
    orders = orders.filter(o => o.tracking_no?.toLowerCase().includes(lq))
  }

  // Filter by product name
  if (params.product) {
    const lp = params.product.toLowerCase()
    // Get all transaction_ids that have matching products
    const { data: matchingItems } = await supabase
      .from('order_items')
      .select('transaction_id')
      .ilike('product_name', `%${params.product}%`)
    
    if (matchingItems && matchingItems.length > 0) {
      const matchingTransactionIds = new Set(matchingItems.map(item => item.transaction_id))
      orders = orders.filter(o => matchingTransactionIds.has(o.transaction_id))
    } else {
      orders = [] // No matches
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Order Tracking</h1>
      <OrdersTable
        initialOrders={orders}
        stores={stores}
        currentParams={params}
      />
    </div>
  )
}
