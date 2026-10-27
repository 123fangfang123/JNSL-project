import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const trackingNos = rows.map((r: Record<string, unknown>) => r.tracking_no as string)
    if (!overwrite) {
      const { data } = await supabase.from('order_shipment').select('tracking_no').in('tracking_no', trackingNos)
      const dupes = (data ?? []).map((r) => r.tracking_no)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    let updatedCount = 0
    for (const row of rows) {
      const { error } = await supabase
        .from('order_shipment')
        .update({ shipment_status: row.shipment_status })
        .eq('tracking_no', row.tracking_no)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      updatedCount++
    }
    return NextResponse.json({ inserted: 0, updated: updatedCount })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
