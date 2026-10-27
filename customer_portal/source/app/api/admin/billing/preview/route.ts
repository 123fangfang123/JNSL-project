import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { orderIds, billingDate } = await req.json()
    const supabase = createServiceClient()

    // Exchange rate is now optional - admin will input it in preview page
    const exchangeRate = 7.0 // Default placeholder value

    // 2. Fetch orders with their store → customer fulfillment_rate
    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('transaction_id, store_name, order_date, order_cny_value, order_ex_rate')
      .in('transaction_id', orderIds)
    if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 })

    // 3. Fetch order items with sku price
    const { data: items, error: itemErr } = await supabase
      .from('order_items')
      .select('transaction_id, qty, sku')
      .in('transaction_id', orderIds)
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 })

    // 4. Fetch shipments → freight
    const { data: shipments, error: shipErr } = await supabase
      .from('order_shipment')
      .select('transaction_id, tracking_no')
      .in('transaction_id', orderIds)
    if (shipErr) return NextResponse.json({ error: shipErr.message }, { status: 500 })

    const trackingNos = (shipments ?? []).map((s) => s.tracking_no)
    const freightMap = new Map<string, number>() // transaction_id → freight cny
    if (trackingNos.length > 0) {
      const { data: freightRows } = await supabase
        .from('freight')
        .select('tracking_no, freight')
        .in('tracking_no', trackingNos)
      for (const fr of freightRows ?? []) {
        const shipment = (shipments ?? []).find((s) => s.tracking_no === fr.tracking_no)
        if (shipment) {
          const total = Number(fr.freight ?? 0)
          freightMap.set(shipment.transaction_id, (freightMap.get(shipment.transaction_id) ?? 0) + total)
        }
      }
    }

    // 5. Fetch store → customer fulfillment_rate
    const storeNames = [...new Set((orders ?? []).map((o) => o.store_name).filter(Boolean))]
    const fulfillmentMap = new Map<string, number>() // store_name → fulfillment_rate
    if (storeNames.length > 0) {
      // First get customer_id for each store
      const { data: storeRows } = await supabase
        .from('customer_store')
        .select('store_name, customer_id')
        .in('store_name', storeNames)
      
      if (storeRows && storeRows.length > 0) {
        // Then get fulfillment_rate for each customer
        const customerIds = [...new Set(storeRows.map(sr => sr.customer_id))]
        const { data: customerRows } = await supabase
          .from('customers')
          .select('customer_id, fulfillment_rate')
          .in('customer_id', customerIds)
        
        // Build a map of customer_id → fulfillment_rate
        const customerRateMap = new Map<string, number>()
        for (const cr of customerRows ?? []) {
          customerRateMap.set(cr.customer_id, Number(cr.fulfillment_rate ?? 2))
        }
        
        // Map store_name → fulfillment_rate
        for (const sr of storeRows) {
          const rate = customerRateMap.get(sr.customer_id) ?? 2
          if (sr.store_name) fulfillmentMap.set(sr.store_name, rate)
        }
      }
    }

    // 6. Group items by transaction_id → cog_cny
    const cogMap = new Map<string, number>()
    
    // First, collect all unique SKU codes from order_items
    const skuCodes = [...new Set((items ?? []).map(item => item.sku).filter(Boolean))]
    
    // Then fetch SKU prices if there are any SKUs
    const skuPriceMap = new Map<string, number>()
    if (skuCodes.length > 0) {
      const { data: skuRows } = await supabase
        .from('sku')
        .select('sku_id, cny_price')
        .in('sku_id', skuCodes)
      
      for (const sku of skuRows ?? []) {
        skuPriceMap.set(sku.sku_id, Number(sku.cny_price ?? 0))
      }
    }
    
    // Now calculate COG for each order
    for (const item of items ?? []) {
      const price = skuPriceMap.get(item.sku) ?? 0
      const qty = Number(item.qty ?? 0)
      cogMap.set(item.transaction_id, (cogMap.get(item.transaction_id) ?? 0) + price * qty)
    }

    // 7. Build preview rows
    const rows = (orders ?? []).map((order) => {
      const cog_cny = cogMap.get(order.transaction_id) ?? 0
      const freight_cny = freightMap.get(order.transaction_id) ?? 0
      const fulfillment_rate = fulfillmentMap.get(order.store_name ?? '') ?? 2
      
      const cog_usd = Math.round((cog_cny / exchangeRate) * 100) / 100
      const shipping_usd = Math.round((freight_cny / exchangeRate) * 100) / 100
      const total_cost_usd = Math.round((cog_usd + shipping_usd + fulfillment_rate) * 100) / 100
      
      return {
        transaction_id: order.transaction_id,
        store_name: order.store_name,
        order_date: order.order_date,
        cog_cny,
        freight_cny,
        exchange_rate: exchangeRate,
        order_cny_value: order.order_cny_value != null ? Number(order.order_cny_value) : null,
        order_ex_rate: order.order_ex_rate != null ? Number(order.order_ex_rate) : null,
        cog_usd,
        shipping_usd,
        fulfillment_usd: fulfillment_rate,
        total_cost_usd,
        // Debug info
        _fulfillment_rate_source: `store=${order.store_name}, rate=${fulfillment_rate}`,
      }
    })

    return NextResponse.json({ exchangeRate, rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
