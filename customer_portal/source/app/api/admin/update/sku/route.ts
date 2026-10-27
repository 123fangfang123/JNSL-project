import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const skus = rows.map((r: Record<string, unknown>) => r.sku as string)
    if (!overwrite) {
      const { data } = await supabase.from('sku').select('sku').in('sku', skus)
      const dupes = (data ?? []).map((r) => r.sku)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('sku').upsert(rows, { onConflict: 'sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: 0, updated: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
