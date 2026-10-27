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
          .from('customer_stock')
          .select('sku')
          .eq('customer_id', row.customer_id)
          .eq('sku', row.sku)
          .limit(1)
        if (data && data.length > 0) dupes.push(`${row.customer_id} / ${row.sku}`)
      }
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('customer_stock').upsert(rows, { onConflict: 'customer_id,sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: 0, updated: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
