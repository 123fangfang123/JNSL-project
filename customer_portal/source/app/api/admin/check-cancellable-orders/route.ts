import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') || '50')))

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  try {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const [{ data: orders, error: ordersError }, { count, error: countError }] = await Promise.all([
      supabase
        .from('cancellable_orders')
        .select('transaction_id, order_number, dispatch_date, order_status, store_name, tracking_no, dest_tracking')
        .order('dispatch_date', { ascending: false })
        .range(from, to),
      supabase
        .from('cancellable_orders')
        .select('transaction_id', { count: 'exact', head: true }),
    ])

    if (ordersError) throw new Error(`查询失败: ${ordersError.message}`)
    if (countError) throw new Error(`计数失败: ${countError.message}`)

    return Response.json({
      data: orders ?? [],
      total: count ?? 0,
      page,
      pageSize,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: `查询失败：${errorMessage}` }, { status: 500 })
  }
}
