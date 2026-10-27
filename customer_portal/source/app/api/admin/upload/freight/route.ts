import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import FREIGHT_BILL_CONFIG from '@/lib/admin/carrier-configs/freight-bill-config'

const CARRIER_DB_NAME: Record<string, string> = {
  yunexpress: 'YUNExpress',
  yanwen: 'YANWEN',
  hh: 'HH EXPRESS',
  xj: 'XJ LOGISTICS'
}

export async function POST(req: NextRequest) {
  try {
    const { rows, carrier } = await req.json() as {
      rows: Record<string, unknown>[]
      carrier: 'yunexpress' | 'yanwen' | 'hh' | 'xj'
    }
    const supabase = createServiceClient()

    const carrierDbName = CARRIER_DB_NAME[carrier] ?? carrier
    const weightUnit = FREIGHT_BILL_CONFIG.WEIGHT_UNIT[carrierDbName] ?? 'g'
    const otherFeeFormula = FREIGHT_BILL_CONFIG.OTHER_FEE_FORMULA[carrierDbName]

    // Transform raw mapped rows into freight table rows
    const freightRows: Record<string, unknown>[] = []

    for (const row of rows) {
      const trackingNo = String(row.tracking_no ?? '').trim()
      if (!trackingNo) continue

      const freightRow: Record<string, unknown> = { tracking_no: trackingNo }

      // billing_date: take date part only
      const rawDate = String(row.billing_date ?? '').trim()
      freightRow.billing_date = rawDate.includes(' ') ? rawDate.split(' ')[0] : rawDate

      // Weight conversion based on carrier config
      if (weightUnit === 'kg') {
        const weightKg = parseFloat(String(row.weight_kg ?? row.weight_g ?? '0'))
        freightRow.weight_g = isNaN(weightKg) ? null : Math.round(weightKg * 1000)
      } else {
        const weightG = parseFloat(String(row.weight_g ?? '0'))
        freightRow.weight_g = isNaN(weightG) ? null : weightG
      }

      // Parse individual fee components
      const freightFee = parseFloat(String(row.freight_fee ?? '0')) || 0
      const registeredFee = parseFloat(String(row.registered_fee ?? '0')) || 0

      freightRow.freight_fee = freightFee || null
      freightRow.registered_fee = registeredFee || null

      // Calculate other_fee based on carrier formula
      if (otherFeeFormula) {
        const freight = parseFloat(String(row.freight ?? '0')) || 0
        const vars: Record<string, number> = { freight, freight_fee: freightFee, registered_fee: registeredFee }
        let expr = otherFeeFormula
        for (const [key, val] of Object.entries(vars)) {
          expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val))
        }
        if (/^[\d\s+\-*/().]+$/.test(expr)) {
          const calculated = Function('"use strict"; return (' + expr + ')')()
          freightRow.other_fee = calculated || null
        } else {
          freightRow.other_fee = null
        }
        freightRow.freight = freight || null
      } else {
        const freight = parseFloat(String(row.freight ?? '0')) || 0
        freightRow.freight = freight || null
        freightRow.other_fee = null
      }

      freightRows.push(freightRow)
    }

    // File-level deduplication: sum fees for same tracking_no
    const freightMap = new Map<string, Record<string, unknown>>()
    for (const row of freightRows) {
      const tn = row.tracking_no as string
      if (freightMap.has(tn)) {
        const existing = freightMap.get(tn)!
        // Sum fee columns
        existing.freight = ((existing.freight as number) || 0) + ((row.freight as number) || 0)
        existing.freight_fee = ((existing.freight_fee as number) || 0) + ((row.freight_fee as number) || 0)
        existing.registered_fee = ((existing.registered_fee as number) || 0) + ((row.registered_fee as number) || 0)
        existing.other_fee = ((existing.other_fee as number) || 0) + ((row.other_fee as number) || 0)
        existing.weight_g = ((existing.weight_g as number) || 0) + ((row.weight_g as number) || 0)
      } else {
        freightMap.set(tn, { ...row })
      }
    }
    const dedupedFreightRows = Array.from(freightMap.values())
    const trackingNos = dedupedFreightRows.map((r) => r.tracking_no as string)

    const CHUNK = 500

    // Three-way branch: insert / skip / sum-update
    let inserted = 0
    let updated = 0
    let skipped = 0

    for (let i = 0; i < dedupedFreightRows.length; i += CHUNK) {
      const batch = dedupedFreightRows.slice(i, i + CHUNK)
      const batchTrackingNos = batch.map((r) => r.tracking_no as string)

      // Fetch existing records
      const { data: existing } = await supabase
        .from('freight')
        .select('tracking_no, freight')
        .in('tracking_no', batchTrackingNos)

      const existingMap = new Map<string, number>()
      for (const r of existing ?? []) {
        existingMap.set(r.tracking_no, r.freight ?? 0)
      }

      const toInsert: Record<string, unknown>[] = []
      const toUpdate: Record<string, unknown>[] = []

      for (const row of batch) {
        const tn = row.tracking_no as string
        const newFreight = row.freight as number
        const existingFreight = existingMap.get(tn)

        if (existingFreight === undefined) {
          // New record - insert
          toInsert.push(row)
        } else if (existingFreight === newFreight) {
          // Same freight - skip
          skipped++
        } else {
          // Different freight - sum and update
          toUpdate.push({
            tracking_no: tn,
            freight: existingFreight + newFreight,
            freight_fee: ((row.freight_fee as number) || 0) + ((existingMap.get(tn) ? 0 : 0)), // Simplified: just update freight
            weight_g: row.weight_g,
          })
        }
      }

      // Insert new records
      if (toInsert.length > 0) {
        const { error } = await supabase.from('freight').insert(toInsert)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        inserted += toInsert.length
      }

      // Update existing records with summed fees
      for (const row of toUpdate) {
        const { error } = await supabase
          .from('freight')
          .update({
            freight: row.freight,
            weight_g: row.weight_g,
          })
          .eq('tracking_no', row.tracking_no)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        updated++
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      skipped,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
