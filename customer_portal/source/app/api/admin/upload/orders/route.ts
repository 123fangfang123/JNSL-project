import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { carrierZhToEn, CARRIER_TO_CHANNEL } from '@/lib/carrier-config'
import { mapAbnormalCode } from '@/lib/admin/abnormal-code-map'

const ORDER_FIELDS = [
  'transaction_id', 'order_number', 'store_name', 'order_date',
  'dispatch_date',
  'order_status', 'country', 'is_abnormal', 'abnormal_code',
  'shipment_date', 'cancel_date', 'return_sign_date', 'is_return', 'return_qty',
  'post_code',
]
const PRICING_FIELDS = ['transaction_id', 'order_cny_value', 'order_ex_rate', 'currency']
const ITEM_FIELDS = [
  'transaction_id', 'sku', 'product_name', 'qty', 'item_id',
  'sku_standard_price', 'platform_product_title', 'sku_image_url',
]

// Excel serial date (days since 1900-01-00) or date string -> YYYY-MM-DD
function toDateStr(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'number') {
    if (val <= 0) return null
    const ms = Math.round((val - 25569) * 86400 * 1000)
    return new Date(ms).toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  if (!s) return null
  const result = s.slice(0, 10).replace(/\//g, '-')
  if (/^0{4}-0{2}-0{2}$/.test(result)) return null
  return result
}

// Chinese order_status -> order_status_enum
const ORDER_STATUS_MAP: Record<string, string> = {
  '已发货': 'shipped',
  '配货中': 'processed',
  '待处理': 'received',
  '待审核': 'processed',
  '已作废': 'cancelled',
  '已退货': 'returned',
  'received': 'received',
  'processed': 'processed',
  'shipped': 'shipped',
  'cancelled': 'cancelled',
  'returned': 'returned',
}

function toOrderStatus(val: unknown): string | null {
  if (val == null) return null
  const s = String(val).trim()
  return ORDER_STATUS_MAP[s] ?? null
}

// Chinese carrier name -> English
function toCarrier(val: unknown): string | null {
  if (val == null) return null
  const s = String(val).trim()
  if (!s) return null
  return carrierZhToEn[s] ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const supabase = createServiceClient()

    // Pre-flight duplicate check - lightweight, just IDs
    if (body.checkDuplicates) {
      const tids = body.transactionIds as string[]
      const { data } = await supabase
        .from('orders')
        .select('transaction_id')
        .in('transaction_id', tids)
      return NextResponse.json({ duplicates: (data ?? []).map((r) => r.transaction_id) })
    }

    const { rows, overwrite, abnormalOverrides } = body as { rows: Record<string, unknown>[]; overwrite: boolean; abnormalOverrides?: Record<string, string> }

    const orderMap = new Map<string, Record<string, unknown>>()
    const carrierWarnings: string[] = []
    const pricingMap = new Map<string, Record<string, unknown>>()
    const itemRows: Record<string, unknown>[] = []
    // tid -> shipment row
    const shipmentByTid = new Map<string, Record<string, unknown>>()
    const RETURN_TRUE_VALUES = new Set(['是', '退货已完成'])

    for (const row of rows) {
      const tid = String(row.transaction_id ?? '')
      if (!orderMap.has(tid)) {
        // --- Build order row ---
        const orderRow: Record<string, unknown> = {}
        for (const f of ORDER_FIELDS) {
          if (row[f] !== undefined) orderRow[f] = row[f]
        }
        orderRow.order_date = toDateStr(orderRow.order_date)
                orderRow.dispatch_date = toDateStr(orderRow.dispatch_date)
        orderRow.shipment_date = toDateStr(orderRow.shipment_date)
        orderRow.order_status = toOrderStatus(orderRow.order_status)
        const carrierRaw = row.carrier
        const carrierEn = toCarrier(carrierRaw)
        if (carrierRaw != null && String(carrierRaw).trim() && !carrierEn) {
          carrierWarnings.push(`物流公司未识别: ${String(carrierRaw)} (订单: ${tid})`)
        }
        if (orderRow.order_number != null) {
          const s = String(orderRow.order_number).trim()
          orderRow.order_number = s || null
        }
        // Cancel date fallback: cancel_date || return_sign_date
        const cancelDate = toDateStr(orderRow.cancel_date)
        const returnSignDate = toDateStr(orderRow.return_sign_date)
        orderRow.cancel_date = cancelDate || returnSignDate
          orderRow.return_sign_date = returnSignDate
        // Convert is_abnormal from Chinese text to boolean, apply abnormal_code mapping
        const isAbnormal = String(orderRow.is_abnormal ?? '').trim() === '是'
        const reasonRaw = String(orderRow.abnormal_code ?? '').trim()
        const abnormalCode = abnormalOverrides?.[tid] ?? mapAbnormalCode(reasonRaw)
        orderRow.is_abnormal = isAbnormal
          // Convert is_return from Chinese text to boolean
          const isReturnRaw = String(orderRow.is_return ?? '').trim()
          orderRow.is_return = RETURN_TRUE_VALUES.has(isReturnRaw)
          // When return is completed, override order_status to 'returned'
          if (isReturnRaw === '退货已完成') {
            orderRow.order_status = 'returned'
          }
        orderRow.abnormal_code = isAbnormal ? (abnormalCode || null) : null
        orderMap.set(tid, orderRow)

        // --- Build pricing row ---
        const pricingRow: Record<string, unknown> = { transaction_id: tid }
        for (const f of PRICING_FIELDS) {
          if (f !== 'transaction_id' && row[f] !== undefined) pricingRow[f] = row[f]
        }
        if (pricingRow.order_cny_value != null) {
          const num = parseFloat(String(pricingRow.order_cny_value))
          pricingRow.order_cny_value = isNaN(num) ? null : num
        }
        if (pricingRow.order_ex_rate != null) {
          const num = parseFloat(String(pricingRow.order_ex_rate))
          pricingRow.order_ex_rate = isNaN(num) ? null : num
        }
        const currency = pricingRow.currency == null ? '' : String(pricingRow.currency).trim()
        pricingRow.currency = currency || null
        pricingMap.set(tid, pricingRow)
      }

      // --- Collect item rows (all SKU lines) ---
      const itemRow: Record<string, unknown> = {}
      for (const f of ITEM_FIELDS) if (row[f] !== undefined) itemRow[f] = row[f]
      if (itemRow.qty != null) itemRow.qty = parseInt(String(itemRow.qty), 10) || null
      if (itemRow.sku_standard_price != null) {
        itemRow.sku_standard_price = parseFloat(String(itemRow.sku_standard_price)) || null
      }
      if (itemRow.sku) itemRows.push(itemRow)

      // --- Build shipment row (first tracking_no per order wins) ---
      const trackingNo = String(row.tracking_no ?? '').trim()
      if (trackingNo && !shipmentByTid.has(tid)) {
        const carrierEn = toCarrier(row.carrier)
        // 物流渠道映射：优先使用"物流渠道"列的值，为空时根据物流公司自动映射
        const channelFromRow = row.channel_id ? String(row.channel_id).trim() : ''
        const channelId = channelFromRow || (carrierEn && CARRIER_TO_CHANNEL[carrierEn]) || null
        
        shipmentByTid.set(tid, {
          transaction_id: tid,
          tracking_no: trackingNo,
          carrier: carrierEn,
            channel_id: channelId,
          process_date: toDateStr(row.shipment_date),
          shipment_status: orderMap.get(tid)?.order_status === 'cancelled' ? 'cancelled' : 'created',
        })
      }
    }

    const orderRows = Array.from(orderMap.values())

    // Deduplicate items by (transaction_id, sku) - merge qty
    const itemMergeMap = new Map<string, Record<string, unknown>>()
    for (const item of itemRows) {
      const key = `${item.transaction_id}:${item.sku}`
      if (itemMergeMap.has(key)) {
        const existing = itemMergeMap.get(key)!
        existing.qty = ((existing.qty as number) || 0) + ((item.qty as number) || 0)
      } else {
        itemMergeMap.set(key, { ...item })
      }
    }
    const dedupedItemRows = Array.from(itemMergeMap.values())
    const shipmentRows = Array.from(shipmentByTid.values())

    // === DB Writes ===

    // 1. Upsert orders
    const { error: ordersErr } = await supabase
      .from('orders')
      .upsert(orderRows, { onConflict: 'transaction_id' })
    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })

    // 2. Upsert order_pricing (uses transaction_id as PK)
    const pricingRows = Array.from(pricingMap.values())
    if (pricingRows.length > 0) {
      const { error: pricingErr } = await supabase
        .from('order_pricing')
        .upsert(pricingRows, { onConflict: 'transaction_id' })
      if (pricingErr) return NextResponse.json({ error: pricingErr.message }, { status: 500 })
    }

    // 3. Update order_items: delete old records first, then insert new ones
    // This ensures items removed from the import file are also removed from DB
    const tidsForItems = orderRows.map(r => r.transaction_id as string)
    if (tidsForItems.length > 0) {
      await supabase.from('order_items').delete().in('transaction_id', tidsForItems)
    }
    if (dedupedItemRows.length > 0) {
      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(dedupedItemRows)
      if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })
    }

    // 4. Update order_shipment: check by tracking_no (the actual PK)
    // Skip shipments whose tracking_no already exists in DB
    let skippedShipments = 0
    let shipmentsToInsert = shipmentRows

    if (shipmentRows.length > 0) {
      const trackingNos = shipmentRows.map(s => s.tracking_no as string)
      const existingTrackingNos = new Set<string>()
      const batchSize = 500
      for (let i = 0; i < trackingNos.length; i += batchSize) {
        const batch = trackingNos.slice(i, i + batchSize)
        const { data } = await supabase
          .from('order_shipment')
          .select('tracking_no')
          .in('tracking_no', batch)
        for (const r of data ?? []) existingTrackingNos.add(r.tracking_no)
      }

      if (existingTrackingNos.size > 0) {
        shipmentsToInsert = shipmentRows.filter(
          s => !existingTrackingNos.has(s.tracking_no as string)
        )
        skippedShipments = existingTrackingNos.size
      }
    }

    if (shipmentsToInsert.length > 0) {
      const { error: shipErr } = await supabase
        .from('order_shipment')
        .insert(shipmentsToInsert)
      if (shipErr) return NextResponse.json({ error: shipErr.message }, { status: 500 })
    }

    return NextResponse.json({
      inserted: orderRows.length,
      updated: overwrite ? orderRows.length : 0,
      itemsCount: dedupedItemRows.length,
      shipmentsCount: shipmentsToInsert.length,
      skippedShipments,
      pricingCount: pricingRows.length,
      carrierWarnings,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}


