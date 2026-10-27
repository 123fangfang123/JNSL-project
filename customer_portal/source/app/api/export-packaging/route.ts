import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const store = searchParams.get('store')
  const q = searchParams.get('q')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let query = supabase
    .from('packaging_po')
    .select('po_date, packaging_name, qty, unit_price_cny, total_cost_cny, exchange_rate_used, billing_date, usd_amt, remarks, store_name')
    .order('po_date', { ascending: false })

  if (from) query = query.gte('po_date', from)
  if (to) query = query.lte('po_date', to)
  if (store) query = query.eq('store_name', store)
  if (q) query = query.ilike('packaging_name', `%${q}%`)

  const { data, error } = await query
  if (error) return new NextResponse(error.message, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((row: any) => ({
    'PO Date': row.po_date ?? '',
    'Packaging Name': row.packaging_name ?? '',
    'Qty': row.qty ?? 0,
    'Unit Price (CNY)': row.unit_price_cny ?? 0,
    'Total Cost (CNY)': row.total_cost_cny ?? 0,
    'Exchange Rate': row.exchange_rate_used ?? '',
    'Billing Date': row.billing_date ?? 'Bill Pending',
    'USD Amount': row.usd_amt ?? 0,
    'Remarks': row.remarks ?? '',
    'Store': row.store_name ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Packaging Cost')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="packaging_${date}.xlsx"`,
    },
  })
}
