import { getPortalContext } from '@/lib/supabase/portal-context'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const store = searchParams.get('store')
  const orderNumber = searchParams.get('orderNumber')
  const trackingNo = searchParams.get('trackingNo')

  const { supabase, customerId, isAdmin } = await getPortalContext()

  if (isAdmin && !customerId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Get customer's stores
  let storeQuery = supabase.from('customer_store').select('store_name').order('store_name')
  if (customerId) storeQuery = storeQuery.eq('customer_id', customerId)
  const { data: storeRows } = await storeQuery
  const customerStores = (storeRows ?? []).map(r => r.store_name)

  let query = supabase
    .from('orders_with_billing_display')
    .select(
      `order_date, order_number, transaction_id, store_name, country, dispatch_date,
       billing_date, cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, ex_rate_used,
       order_status, abnormal_code, remarks`
    )
    .eq('is_abnormal', true)

  // Apply customer store filter
  if (customerId && customerStores.length > 0) {
    query = query.in('store_name', customerStores)
  } else if (customerId && customerStores.length === 0) {
    const ws = XLSX.utils.json_to_sheet([])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Abnormal Orders')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="abnormal_orders_${date}.xlsx"`,
      },
    })
  }

  if (from) query = query.gte('order_date', from)
  if (to) query = query.lte('order_date', to + 'T23:59:59')
  if (store) query = query.eq('store_name', store)
  if (orderNumber) query = query.ilike('order_number', `%${orderNumber}%`)

  // Handle tracking number filter - query order_shipment first
  if (trackingNo) {
    const { data: matchingShipments } = await supabase
      .from('order_shipment')
      .select('transaction_id')
      .ilike('tracking_no', `%${trackingNo}%`)
      .limit(1000)

    if (!matchingShipments || matchingShipments.length === 0) {
      const ws = XLSX.utils.json_to_sheet([])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Abnormal Orders')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      const date = new Date().toISOString().slice(0, 10)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="abnormal_orders_${date}.xlsx"`,
        },
      })
    }
    const trackingFilterIds = [...new Set(matchingShipments.map(s => s.transaction_id))]
    query = query.in('transaction_id', trackingFilterIds)
  }

  // Fetch orders in batches (Supabase server max_rows = 1000)
  const batchSize = 1000
  let allOrderRows: any[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: batchData, error: batchError } = await query
      .order('order_date', { ascending: false })
      .range(offset, offset + batchSize - 1)

    if (batchError) return new NextResponse(batchError.message, { status: 500 })

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

  // Fetch shipments separately to avoid nested query timeout
  let rows = allOrderRows
  if (rows.length > 0) {
    const transactionIds = rows.map(r => r.transaction_id)
    const batchSize = 100
    const batches = []
    for (let i = 0; i < transactionIds.length; i += batchSize) {
      batches.push(transactionIds.slice(i, i + batchSize))
    }

    let allShipmentData: any[] = []
    for (const batch of batches) {
      const { data: shipmentData } = await supabase
        .from('order_shipment')
        .select('transaction_id, tracking_no, carrier, dest_tracking')
        .in('transaction_id', batch)
      if (shipmentData) {
        allShipmentData = allShipmentData.concat(shipmentData)
      }
    }

    const shipmentMap = new Map<string, any[]>()
    for (const s of allShipmentData) {
      if (!shipmentMap.has(s.transaction_id)) {
        shipmentMap.set(s.transaction_id, [])
      }
      shipmentMap.get(s.transaction_id)!.push(s)
    }

    rows = rows.map(order => ({
      ...order,
      order_shipment: shipmentMap.get(order.transaction_id) ?? []
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows = rows.map((row: any) => {
    const shipments: any[] = Array.isArray(row.order_shipment)
      ? row.order_shipment
      : row.order_shipment ? [row.order_shipment] : []
    const s = shipments[0] ?? null
    const total = row.total_cost_usd ?? ((row.cog_usd ?? 0) + (row.shipping_usd ?? 0) + (row.fulfillment_usd ?? 0))

    return {
      'Creation Date': row.order_date ?? '',
      'Order #': row.order_number ?? '',
      'Transaction #': row.transaction_id ?? '',
      'Store': row.store_name ?? '',
      'Country': row.country ?? '',
      'Tracking No.': s?.tracking_no ?? '',
      'Carrier': s?.carrier ?? '',
      'Dispatch Date': row.dispatch_date ?? '',
      'Dest Tracking': s?.dest_tracking ?? '',
      'Status': row.order_status ?? '',
      'Abnormal Code': row.abnormal_code ?? '',
      'Remarks': row.remarks ?? '',
      'Exchange Rate': row.ex_rate_used ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Abnormal Orders')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="abnormal_orders_${date}.xlsx"`,
    },
  })
}
