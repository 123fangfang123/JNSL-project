import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    if (!overwrite) {
      const dupes: string[] = []
      for (const row of rows) {
        const { data } = await supabase
          .from('amount_received')
          .select('transaction_no')
          .eq('customer_id', row.customer_id)
          .eq('date_received', row.date_received)
          .eq('amount_received', row.amount_received)
          .limit(1)
        if (data && data.length > 0) {
          dupes.push(`${row.customer_id} / ${row.date_received} / ${row.amount_received}`)
        }
      }
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('amount_received').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
