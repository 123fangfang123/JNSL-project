import { getPortalContext } from '@/lib/supabase/portal-context'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') ?? '100')))
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const store = searchParams.get('store')
  const status = searchParams.get('status')
  const orderNumber = searchParams.get('orderNumber')
  const trackingNo = searchParams.get('trackingNo')
  const product = searchParams.get('product')
  const isAbnormal = searchParams.get('isAbnormal')
  const sort = searchParams.get('sort') || 'order_number'
  const sortDir = searchParams.get('sortDir') || 'asc'

  const VIEW_SORT_FIELDS = new Set(['order_date', 'order_number', 'transaction_id', 'store_name', 'country', 'dispatch_date', 'order_status', 'is_abnormal'])
  const SHIPMENT_SORT_FIELDS = new Set(['tracking_no', 'carrier'])

  const { supabase, customerId, isAdmin } = await getPortalContext()

  if (isAdmin && !customerId) {
    return NextResponse.json({ error: 'Select a customer to view orders' }, { status: 401 })
  }
  if (!isAdmin && !customerId) {
    return NextResponse.json({ error: 'No customer account found' }, { status: 403 })
  }

  let storeQuery = supabase.from('customer_store').select('store_name').order('store_name')
  if (customerId) storeQuery = storeQuery.eq('customer_id', customerId)
  const { data: storeRows } = await storeQuery
  const customerStores = (storeRows ?? []).map(r => r.store_name)

  if (customerId && customerStores.length === 0) {
    return NextResponse.json({ orders: [], total: 0, stats: { total: 0, shipped: 0, processed: 0, received: 0, cancelled: 0, returned: 0, abnormal: 0 } })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (query: any, forStats = false) => {
    if (customerId && customerStores.length > 0) query = query.in('store_name', customerStores)
    if (from) query = query.gte('order_date', from)
    if (to) query = query.lte('order_date', to + 'T23:59:59')
    if (store) query = query.eq('store_name', store)
    if (status) query = query.eq('order_status', status)
    if (orderNumber) query = query.ilike('order_number', `%${orderNumber}%`)
    if (isAbnormal === 'true') query = query.eq('is_abnormal', true)
    else if (isAbnormal === 'false') query = query.eq('is_abnormal', false)
    else if (isAbnormal !== 'all') query = query.eq('is_abnormal', false)
    return query
  }

  // Handle product filter
  let productFilterIds: string[] | null = null
  if (product) {
    const { data: matchingItems } = await supabase
      .from('order_items')
      .select('transaction_id')
      .ilike('product_name', `%${product}%`)
      .limit(1000)

    if (!matchingItems || matchingItems.length === 0) {
      return NextResponse.json({ orders: [], total: 0, stats: { total: 0, shipped: 0, processed: 0, received: 0, cancelled: 0, returned: 0, abnormal: 0 } })
    }
    productFilterIds = [...new Set(matchingItems.map(i => i.transaction_id))]
  }

  // Handle tracking number filter
  let trackingFilterIds: string[] | null = null
  if (trackingNo) {
    const { data: matchingShipments } = await supabase
      .from('order_shipment')
      .select('transaction_id')
      .ilike('tracking_no', `%${trackingNo}%`)
      .limit(1000)

    if (!matchingShipments || matchingShipments.length === 0) {
      return NextResponse.json({ orders: [], total: 0, stats: { total: 0, shipped: 0, processed: 0, received: 0, cancelled: 0, returned: 0, abnormal: 0 } })
    }
    trackingFilterIds = [...new Set(matchingShipments.map(s => s.transaction_id))]
  }

  // Get total count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery: any = supabase.from('orders_with_billing_display').select('transaction_id', { count: 'exact', head: true })
  countQuery = applyFilters(countQuery)
  if (productFilterIds) countQuery = countQuery.in('transaction_id', productFilterIds)
  if (trackingFilterIds) countQuery = countQuery.in('transaction_id', trackingFilterIds)
  const { count, error: countError } = await countQuery
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
  const total = count ?? 0

  // Compute stats from all filtered orders (batched to handle Supabase max_rows=1000)
  let allStatuses: Array<{ order_status: string; is_abnormal: boolean }> = []
  let statsOffset = 0
  let statsMore = true
  while (statsMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let statsQuery: any = supabase
      .from('orders_with_billing_display')
      .select('order_status, is_abnormal')
    statsQuery = applyFilters(statsQuery, true)
    if (productFilterIds) statsQuery = statsQuery.in('transaction_id', productFilterIds)
    if (trackingFilterIds) statsQuery = statsQuery.in('transaction_id', trackingFilterIds)
    const { data: statsBatch } = await statsQuery.range(statsOffset, statsOffset + 999)
    if (statsBatch && statsBatch.length > 0) {
      allStatuses = allStatuses.concat(statsBatch)
      statsOffset += 1000
      if (statsBatch.length < 1000) statsMore = false
    } else {
      statsMore = false
    }
  }
  const stats = {
    total,
    shipped: allStatuses.filter(o => o.order_status === 'shipped').length,
    processed: allStatuses.filter(o => o.order_status === 'processed').length,
    received: allStatuses.filter(o => o.order_status === 'received').length,
    cancelled: allStatuses.filter(o => o.order_status === 'cancelled').length,
    returned: allStatuses.filter(o => o.order_status === 'returned').length,
    abnormal: allStatuses.filter(o => o.is_abnormal).length,
  }

  // Fetch one page of orders
  const offset = (page - 1) * pageSize
  const ascending = sortDir === 'asc'
  const useShipmentSort = SHIPMENT_SORT_FIELDS.has(sort)
  let sortedTransactionIds: string[] | null = null

  if (useShipmentSort) {
    // Step 1: Get all matching transaction IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let idQuery: any = supabase.from('orders_with_billing_display').select('transaction_id')
    idQuery = applyFilters(idQuery)
    if (productFilterIds) idQuery = idQuery.in('transaction_id', productFilterIds)
    if (trackingFilterIds) idQuery = idQuery.in('transaction_id', trackingFilterIds)

    const allIds: string[] = []
    let idOffset = 0
    let idMore = true
    while (idMore) {
      const { data: idBatch } = await idQuery.range(idOffset, idOffset + 999)
      if (idBatch && idBatch.length > 0) {
        allIds.push(...idBatch.map((r: any) => r.transaction_id))
        idOffset += 1000
        if (idBatch.length < 1000) idMore = false
      } else {
        idMore = false
      }
    }

    if (allIds.length === 0) {
      return NextResponse.json({ orders: [], total, stats })
    }

    // Step 2: Fetch shipment data for all matching transactions (batched)
    let allShipmentsForSort: any[] = []
    for (let i = 0; i < allIds.length; i += 100) {
      const batch = allIds.slice(i, i + 100)
      const { data: shipData } = await supabase
        .from('order_shipment')
        .select(`transaction_id, ${sort}`)
        .in('transaction_id', batch)
      if (shipData) allShipmentsForSort = allShipmentsForSort.concat(shipData)
    }

    const shipmentMap = new Map<string, string>()
    for (const s of allShipmentsForSort) {
      if (!shipmentMap.has(s.transaction_id)) {
        shipmentMap.set(s.transaction_id, s[sort] ?? '')
      }
    }

    // Step 3: Sort transaction IDs by shipment field
    allIds.sort((a, b) => {
      const av = shipmentMap.get(a) ?? ''
      const bv = shipmentMap.get(b) ?? ''
      return ascending ? av.localeCompare(bv) : bv.localeCompare(av)
    })

    sortedTransactionIds = allIds.slice(offset, offset + pageSize)

    if (sortedTransactionIds.length === 0) {
      return NextResponse.json({ orders: [], total, stats })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery: any = supabase
    .from('orders_with_billing_display')
    .select(
      `transaction_id, is_abnormal, order_number, store_name, order_date, dispatch_date,
       order_status, country, abnormal_code, remarks`
    )
  ordersQuery = applyFilters(ordersQuery)
  if (productFilterIds) ordersQuery = ordersQuery.in('transaction_id', productFilterIds)
  if (trackingFilterIds) ordersQuery = ordersQuery.in('transaction_id', trackingFilterIds)

  if (sortedTransactionIds) {
    ordersQuery = ordersQuery.in('transaction_id', sortedTransactionIds)
  }

  if (!useShipmentSort && VIEW_SORT_FIELDS.has(sort)) {
    ordersQuery = ordersQuery.order(sort, { ascending })
  } else if (!useShipmentSort) {
    ordersQuery = ordersQuery.order('order_number', { ascending: true })
  }

  const { data: orders, error: ordersError } = await ordersQuery
    .range(0, sortedTransactionIds ? sortedTransactionIds.length - 1 : pageSize - 1)

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 })

  const orderRows = orders ?? []
  let enriched = orderRows

  // Fetch shipments for this page of orders
  if (orderRows.length > 0) {
    const transactionIds = orderRows.map((r: any) => r.transaction_id)
    const batchSize = 100
    const batches = []
    for (let i = 0; i < transactionIds.length; i += batchSize) {
      batches.push(transactionIds.slice(i, i + batchSize))
    }

    let allShipments: any[] = []
    for (const batch of batches) {
      const { data: shipmentData } = await supabase
        .from('order_shipment')
        .select('transaction_id, tracking_no, carrier, shipment_status, dest_tracking')
        .in('transaction_id', batch)
      if (shipmentData) allShipments = allShipments.concat(shipmentData)
    }

    const shipmentMap = new Map<string, any[]>()
    for (const s of allShipments) {
      if (!shipmentMap.has(s.transaction_id)) shipmentMap.set(s.transaction_id, [])
      shipmentMap.get(s.transaction_id)!.push(s)
    }

    enriched = orderRows.map((order: any) => {
      const shipments = shipmentMap.get(order.transaction_id) ?? []
      shipments.sort((a: any, b: any) => (b.tracking_no ?? '').localeCompare(a.tracking_no ?? ''))
      const s = shipments[0] ?? null
      return {
        transaction_id: order.transaction_id,
        is_abnormal: order.is_abnormal,
        order_number: order.order_number,
        store_name: order.store_name,
        order_date: order.order_date,
        order_status: order.order_status,
        country: order.country,
        abnormal_code: order.abnormal_code ?? null,
        remarks: order.remarks ?? null,
        tracking_no: s?.tracking_no ?? null,
        carrier: s?.carrier ?? null,
        dispatch_date: order.dispatch_date ?? null,
        shipment_status: s?.shipment_status ?? null,
        dest_tracking: s?.dest_tracking ?? null,
      }
    })
  }

  if (sortedTransactionIds) {
    const orderMap = new Map(enriched.map((o: any) => [o.transaction_id, o]))
    enriched = sortedTransactionIds
      .filter(id => orderMap.has(id))
      .map(id => orderMap.get(id)!)
  }

  return NextResponse.json({ orders: enriched, total, stats })
}
