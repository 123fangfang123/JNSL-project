import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const dates = rows.map((r: Record<string, unknown>) => r.transaction_date as string)
    if (!overwrite) {
      const { data } = await supabase.from('exchange_rate').select('transaction_date').in('transaction_date', dates)
      const dupes = (data ?? []).map((r) => r.transaction_date)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('exchange_rate').upsert(rows, { onConflict: 'transaction_date' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
