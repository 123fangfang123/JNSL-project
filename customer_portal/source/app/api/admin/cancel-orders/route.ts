import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const { transactionIds } = await request.json()

  if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return Response.json({ error: '请选择要作废的订单' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('orders')
    .update({ order_status: 'cancelled', cancel_date: new Date().toISOString().split('T')[0] })
    .in('transaction_id', transactionIds)
    .eq('order_status', 'shipped')
    .select('transaction_id')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, cancelled: data?.length || 0 })
}
