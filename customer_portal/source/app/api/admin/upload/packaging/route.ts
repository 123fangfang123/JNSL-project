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
          .from('packaging_po')
          .select('po_date')
          .eq('po_date', row.po_date)
          .eq('sku', row.sku)
          .limit(1)
        if (data && data.length > 0) dupes.push(`${row.po_date} / ${row.sku}`)
      }
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('packaging_po').upsert(rows, { onConflict: 'po_date,sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
