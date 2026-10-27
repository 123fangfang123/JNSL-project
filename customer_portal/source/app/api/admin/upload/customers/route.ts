import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const ids = rows.map((r: Record<string, unknown>) => r.customer_id as string)
    if (!overwrite) {
      const { data } = await supabase.from('customers').select('customer_id').in('customer_id', ids)
      const dupes = (data ?? []).map((r) => r.customer_id)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('customers').upsert(rows, { onConflict: 'customer_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
