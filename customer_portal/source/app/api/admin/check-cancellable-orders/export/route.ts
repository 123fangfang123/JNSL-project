import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

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
    // 服务端 max_rows 限制为 1000，用 range 分批拉取全量
    const batchSize = 1000
    const rows: Array<{
      transaction_id: string
      order_number: string
      store_name: string
      order_status: string
      dispatch_date: string
      tracking_no: string | null
      dest_tracking: string | null
    }> = []

    let offset = 0
    while (true) {
      const { data, error } = await supabase
        .from('cancellable_orders')
        .select('transaction_id, order_number, store_name, order_status, dispatch_date, tracking_no, dest_tracking')
        .order('dispatch_date', { ascending: false })
        .range(offset, offset + batchSize - 1)

      if (error) throw new Error(`查询失败: ${error.message}`)
      if (!data || data.length === 0) break

      rows.push(...data)
      if (data.length < batchSize) break
      offset += batchSize
    }

    const sheetRows = rows.map((row, i) => ({
      '#': i + 1,
      '交易编号': row.transaction_id ?? '',
      '订单编号': row.order_number ?? '',
      '店铺': row.store_name ?? '',
      '订单状态': row.order_status ?? '',
      '发货时间': row.dispatch_date ?? '',
      '运单号': row.tracking_no ?? '',
      '目的追踪号': row.dest_tracking ?? '',
    }))

    const ws = XLSX.utils.json_to_sheet(sheetRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cancellable Orders')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const date = new Date().toISOString().slice(0, 10)
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cancellable_orders_${date}.xlsx"`,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `导出失败：${errorMessage}` }, { status: 500 })
  }
}
