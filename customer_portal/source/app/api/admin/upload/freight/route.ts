import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import FREIGHT_BILL_CONFIG from '@/lib/admin/carrier-configs/freight-bill-config'
import fs from 'fs'
import path from 'path'

const CARRIER_DB_NAME: Record<string, string> = {
  yunexpress: 'YUNExpress',
  yanwen: 'YANWEN',
  hh: 'HH EXPRESS',
  xj: 'XJ LOGISTICS',
  gc: 'GC'
}

// 日志工具函数
function getLogTimestamp(): string {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().replace('T', ' ').substring(0, 19)
}

function saveImportLog(
  carrierName: string,
  totalRows: number,
  inserted: number,
  updated: number,
  skipped: number,
  errors: string[] = [],
  updatedTrackingNos: string[] = []
): string {
  const logDir = path.join(process.cwd(), 'Data Import', 'Process Log')
  
  // 确保日志目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const timestamp = utc8.toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const logFilePath = path.join(logDir, `${carrierName}_Freight_${timestamp}.log`)
  
  const logContent = [
    `[${getLogTimestamp()}] === 运费账单导入（网页端） ===`,
    ``,
    `[${getLogTimestamp()}] 🎯 导入方式: 网页上传`,
    `[${getLogTimestamp()}] 📋 物流商: ${carrierName}`,
    `[${getLogTimestamp()}] 📊 总记录数: ${totalRows}`,
    ``,
    `[${getLogTimestamp()}] 💾 写入结果:`,
    `[${getLogTimestamp()}]    新增: ${inserted}`,
    `[${getLogTimestamp()}]    更新（费用相加）: ${updated}`,
    `[${getLogTimestamp()}]    跳过（freight 相同）: ${skipped}`,
    `[${getLogTimestamp()}]    错误: ${errors.length}`,
    ``,
    ...(updatedTrackingNos.length > 0
      ? [
          `[${getLogTimestamp()}] 🔄 费用相加更新的运单:`,
          ...updatedTrackingNos.map((tn, idx) => `[${getLogTimestamp()}]    ${idx + 1}. ${tn}`),
          ``
        ]
      : []),
    ...(errors.length > 0
      ? [
          `[${getLogTimestamp()}] ❌ 错误详情:`,
          ...errors.map((err, idx) => `[${getLogTimestamp()}]    ${idx + 1}. ${err}`),
          ``
        ]
      : []),
    `[${getLogTimestamp()}] ✅ 导入完成`,
  ].join('\n')
  
  fs.writeFileSync(logFilePath, logContent, 'utf-8')
  return logFilePath
}

export async function POST(req: NextRequest) {
  const errors: string[] = []
  let carrierName = 'UNKNOWN'
  let totalRows = 0
  
  try {
    const { rows, carrier } = await req.json() as {
      rows: Record<string, unknown>[]
      carrier: 'yunexpress' | 'yanwen' | 'hh' | 'xj' | 'gc'
    }
    
    carrierName = CARRIER_DB_NAME[carrier] ?? carrier
    totalRows = rows.length
    
    const supabase = createServiceClient()

    const carrierDbName = CARRIER_DB_NAME[carrier] ?? carrier
    const weightUnit = (FREIGHT_BILL_CONFIG.WEIGHT_UNIT as Record<string, string>)[carrierDbName] ?? 'g'
    const otherFeeFormula = (FREIGHT_BILL_CONFIG.OTHER_FEE_FORMULA as Record<string, string | null>)[carrierDbName]
    const freightMultiplier = (FREIGHT_BILL_CONFIG.FREIGHT_MULTIPLIER as Record<string, number | null>)[carrierDbName]

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

      // Apply freight multiplier (e.g., GC needs × 6.7 to convert USD to CNY)
      let freight = parseFloat(String(row.freight ?? '0')) || 0
      if (freightMultiplier && freight > 0) {
        freight = Math.round(freight * freightMultiplier * 100) / 100
      }

      // Calculate other_fee based on carrier formula
      if (otherFeeFormula) {
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
    const updatedTrackingNos: string[] = []

    for (let i = 0; i < dedupedFreightRows.length; i += CHUNK) {
      const batch = dedupedFreightRows.slice(i, i + CHUNK)
      const batchTrackingNos = batch.map((r) => r.tracking_no as string)

      // Fetch existing records
      const { data: existing, error: fetchError } = await supabase
        .from('freight')
        .select('tracking_no, freight')
        .in('tracking_no', batchTrackingNos)

      if (fetchError) {
        errors.push(`批量查询失败: ${fetchError.message}`)
        continue
      }

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
          updatedTrackingNos.push(tn)
        }
      }

      // Insert new records
      if (toInsert.length > 0) {
        const { error } = await supabase.from('freight').insert(toInsert)
        if (error) {
          errors.push(`批量插入失败: ${error.message}`)
          // Try inserting one by one
          for (const row of toInsert) {
            const { error: ie } = await supabase.from('freight').insert(row)
            if (ie) {
              errors.push(`插入失败: ${row.tracking_no} - ${ie.message}`)
            } else {
              inserted++
            }
          }
        } else {
          inserted += toInsert.length
        }
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
        if (error) {
          errors.push(`更新失败: ${row.tracking_no} - ${error.message}`)
        } else {
          updated++
        }
      }
    }

    // Save log
    const logFilePath = saveImportLog(carrierName, totalRows, inserted, updated, skipped, errors, updatedTrackingNos)

    return NextResponse.json({
      inserted,
      updated,
      skipped,
      logFile: logFilePath,
      updatedTrackingNos: updatedTrackingNos.length > 0 ? updatedTrackingNos : undefined,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (err) {
    const errorMessage = String(err)
    errors.push(`导入异常: ${errorMessage}`)
    
    // Save error log
    const logFilePath = saveImportLog(carrierName, totalRows, 0, 0, 0, errors, [])
    
    return NextResponse.json({ 
      error: errorMessage,
      logFile: logFilePath
    }, { status: 500 })
  }
}
