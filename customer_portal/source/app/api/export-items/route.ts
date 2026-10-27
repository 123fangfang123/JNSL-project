import { getPortalContext } from '@/lib/supabase/portal-context'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const store = searchParams.get('store')
  const status = searchParams.get('status')
  const q = searchParams.get('q')
  const isAbnormal = searchParams.get('isAbnormal')

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
    .select(`order_date, order_number, transaction_id, store_name`)

  // Apply customer store filter
  if (customerId && customerStores.length > 0) {
    query = query.in('store_name', customerStores)
  } else if (customerId && customerStores.length === 0) {
    const ws = XLSX.utils.json_to_sheet([])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Order Items')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="order_items_${date}.xlsx"`,
      },
    })
  }

  // Filter by abnormal status
  if (isAbnormal === 'true') {
    query = query.eq('is_abnormal', true)
  } else if (isAbnormal === 'false') {
    query = query.eq('is_abnormal', false)
  }

  if (from) query = query.gte('order_date', from)
  if (to) query = query.lte('order_date', to + 'T23:59:59')
  if (store) query = query.eq('store_name', store)
  if (status) query = query.eq('order_status', status)
  if (q && /^\d+$/.test(q) && q.length <= 10) query = query.eq('order_number', parseInt(q))

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

  // Fetch order_items in batches
  let orders = allOrderRows
  if (orders.length > 0) {
    const transactionIds = orders.map((r: any) => r.transaction_id)
    const txBatchSize = 100
    let allItems: any[] = []

    for (let i = 0; i < transactionIds.length; i += txBatchSize) {
      const batch = transactionIds.slice(i, i + txBatchSize)
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('transaction_id, item_id, product_name, qty')
        .in('transaction_id', batch)
      if (itemsData) {
        allItems = allItems.concat(itemsData)
      }
    }

    // Build a map from transaction_id to order info
    const orderMap = new Map<string, any>()
    for (const o of orders) {
      orderMap.set(o.transaction_id, o)
    }

    // Flatten: one row per item
    const rows = allItems.map((item: any) => {
      const order = orderMap.get(item.transaction_id)
      return {
        'Order Date': order?.order_date ?? '',
        'Order #': order?.order_number ?? '',
        'Transaction #': item.transaction_id ?? '',
        'Store': order?.store_name ?? '',
        'Product Name': item.product_name ?? '',
        'Qty': item.qty ?? '',
        'Item ID': item.item_id ?? '',
      }
    })

    // Filter by text search (product name or transaction id)
    if (q && !/^\d+$/.test(q)) {
      const lq = q.toLowerCase()
      const filtered = rows.filter(r =>
        String(r['Product Name']).toLowerCase().includes(lq) ||
        String(r['Transaction #']).toLowerCase().includes(lq)
      )
      rows.splice(0, rows.length, ...filtered)
    }

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Order Items')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="order_items_${date}.xlsx"`,
      },
    })
  }

  // No orders found
  const ws = XLSX.utils.json_to_sheet([])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Order Items')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="order_items_${date}.xlsx"`,
    },
  })
}
