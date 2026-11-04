import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

interface ReturnedOrderRow {
  transaction_id: string
  order_number: string
  dispatch_date: string
  order_status: string
  store_name: string
  tracking_no: string | null
  dest_tracking: string | null
  shipment_status: string
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  try {
    // 服务端 max_rows 限制为 1000，用 range 分批拉取全量退货运单
    const pageSize = 1000
    const returnedTransactionIds = new Set<string>()
    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('order_shipment')
        .select('transaction_id')
        .eq('shipment_status', 'returned')
        .range(offset, offset + pageSize - 1)

      if (error) throw new Error(`查询退货运单失败: ${error.message}`)
      if (!data || data.length === 0) break

      for (const s of data) {
        if (s.transaction_id) returnedTransactionIds.add(s.transaction_id)
      }
      if (data.length < pageSize) break
      offset += pageSize
    }

    const ids = [...returnedTransactionIds]
    const results: ReturnedOrderRow[] = []

    // .in() 条件过长会超出 URL 限制，按 100 个一批查询
    const chunkSize = 100
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)

      const [{ data: orders, error: ordersError }, { data: shipments, error: shipmentsError }] =
        await Promise.all([
          supabase
            .from('orders')
            .select('transaction_id, order_number, dispatch_date, order_status, store_name')
            .eq('order_status', 'shipped')
            .in('transaction_id', chunk),
          supabase
            .from('order_shipment')
            .select('transaction_id, tracking_no, dest_tracking, shipment_status')
            .in('transaction_id', chunk),
        ])

      if (ordersError) throw new Error(`查询订单失败: ${ordersError.message}`)
      if (shipmentsError) throw new Error(`查询运单失败: ${shipmentsError.message}`)

      const shipmentMap = new Map<
        string,
        Array<{ tracking_no: string | null; dest_tracking: string | null; shipment_status: string | null }>
      >()
      for (const shipment of shipments || []) {
        const tid = shipment.transaction_id
        if (!shipmentMap.has(tid)) shipmentMap.set(tid, [])
        shipmentMap.get(tid)!.push({
          tracking_no: shipment.tracking_no,
          dest_tracking: shipment.dest_tracking,
          shipment_status: shipment.shipment_status,
        })
      }

      for (const order of orders || []) {
        const ships = shipmentMap.get(order.transaction_id) || []
        const returnedShip = ships.find(s => s.shipment_status === 'returned')
        results.push({
          transaction_id: order.transaction_id,
          order_number: order.order_number,
          dispatch_date: order.dispatch_date,
          order_status: order.order_status,
          store_name: order.store_name,
          tracking_no: returnedShip?.tracking_no || ships[0]?.tracking_no || null,
          dest_tracking: returnedShip?.dest_tracking || ships[0]?.dest_tracking || null,
          shipment_status: 'returned',
        })
      }
    }

    results.sort((a, b) => String(a.dispatch_date).localeCompare(String(b.dispatch_date)))

    const sheetRows = results.map((row, i) => ({
      '#': i + 1,
      '交易编号': row.transaction_id ?? '',
      '订单编号': row.order_number ?? '',
      '店铺': row.store_name ?? '',
      '订单状态': row.order_status ?? '',
      '发货时间': row.dispatch_date ?? '',
      '运单号': row.tracking_no ?? '',
      '目的追踪号': row.dest_tracking ?? '',
      '物流状态': row.shipment_status ?? '',
    }))

    const ws = XLSX.utils.json_to_sheet(sheetRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Returned Orders')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const date = new Date().toISOString().slice(0, 10)
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="returned_orders_${date}.xlsx"`,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `导出失败：${errorMessage}` }, { status: 500 })
  }
}
