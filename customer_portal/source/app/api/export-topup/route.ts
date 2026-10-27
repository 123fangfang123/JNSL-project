import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  let query = supabase
    .from('amount_received')
    .select('date_received, amount_transferred, amount_received')
    .order('date_received', { ascending: false })

  if (from) query = query.gte('date_received', from)
  if (to) query = query.lte('date_received', to)

  const { data, error } = await query
  if (error) return new NextResponse(error.message, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((row: any) => {
    const diff = row.amount_transferred != null && row.amount_received != null
      ? Math.round((row.amount_transferred - row.amount_received) * 100) / 100
      : null
    return {
      'Date': row.date_received ?? '',
      'Amount Transferred (USD)': row.amount_transferred ?? '',
      'Amount Received (USD)': row.amount_received ?? '',
      'Difference': diff ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Top-up History')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="topup_${date}.xlsx"`,
    },
  })
}
