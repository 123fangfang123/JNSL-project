import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { billingDate, exRateUsed, orders } = await req.json()
    const supabase = createServiceClient()

    let updated = 0
    for (const order of orders) {
      const totalCostUsd = Math.round(
        ((order.cog_usd ?? 0) + (order.shipping_usd ?? 0) + (order.fulfillment_usd ?? 0)) * 100
      ) / 100

      const { error } = await supabase
        .from('orders')
        .update({
          billing_date: billingDate,
          ex_rate_used: exRateUsed,
          cog_usd: order.cog_usd,
          shipping_usd: order.shipping_usd,
          fulfillment_usd: order.fulfillment_usd,
          total_cost_usd: totalCostUsd,
        })
        .eq('transaction_id', order.transaction_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      updated++
    }

    return NextResponse.json({ updated })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
