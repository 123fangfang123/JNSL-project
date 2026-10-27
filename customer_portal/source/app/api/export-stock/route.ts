import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: customerUser } = await supabase
    .from('customer_user')
    .select('customer_id')
    .eq('auth_user_id', user.id)
    .single()

  let customer = null
  if (customerUser) {
    const { data } = await supabase
      .from('customers')
      .select('default_ex_rate')
      .eq('customer_id', customerUser.customer_id)
      .single()
    customer = data
  }

  const exRate = customer?.default_ex_rate ?? 6.6

  const { data: stockRows, error } = await supabase
    .from('customer_stock')
    .select('sku, qty, snapshot_at')
    .order('sku')

  if (error) return new NextResponse(error.message, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skuIds = (stockRows ?? []).map((r: any) => r.sku)
  const { data: skuRows } = skuIds.length > 0
    ? await supabase.from('sku').select('sku, sku_name, cny_price').in('sku', skuIds)
    : { data: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skuMap = new Map((skuRows ?? []).map((s: any) => [s.sku, s]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (stockRows ?? []).map((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skuData = skuMap.get(row.sku) as any
    const unitPriceUsd = skuData?.cny_price != null
      ? Math.round((skuData.cny_price / exRate) * 100) / 100
      : null
    const stockValueUsd = unitPriceUsd != null
      ? Math.round(row.qty * unitPriceUsd * 100) / 100
      : null
    return {
      'Product Name': skuData?.sku_name ?? '',
      'Qty': row.qty ?? 0,
      'Unit Price (USD)': unitPriceUsd ?? '',
      'Stock Value (USD)': stockValueUsd ?? '',
      'Last Updated': row.snapshot_at?.slice(0, 10) ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stock on Hand')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="stock_${date}.xlsx"`,
    },
  })
}
