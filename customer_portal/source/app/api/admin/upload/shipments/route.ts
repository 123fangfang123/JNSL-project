import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { createServiceClient } from '@/lib/supabase/service'
import { SHIPMENT_STATUS_MAP, CARRIER_DB_NAME } from '@/lib/admin/carrier-configs/carrier-shipment-config'

function toDateStr(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'number') {
    const ms = Math.round((val - 25569) * 86400 * 1000)
    return new Date(ms).toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  if (!s) return null
  return s.slice(0, 10).replace(/\//g, '-')
}

/**
 * 将 Excel 状态值转换为数据库枚举值
 * 使用统一配置中的 SHIPMENT_STATUS_MAP，按物流商区分映射规则
 * 未映射的状态值设为 'shipped'（安全默认值）
 */
function toShipmentStatus(val: unknown, carrierDbName: string): string {
  if (val == null) return 'shipped'
  const s = String(val).trim()
  const carrierMap = SHIPMENT_STATUS_MAP[carrierDbName]
  if (!carrierMap) return 'shipped'
  return carrierMap[s] ?? 'shipped'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const supabase = createServiceClient()

    const { rows, carrier } = body as {
      rows: Record<string, unknown>[]
      carrier: 'yunexpress' | 'yanwen' | 'hh' | 'xj'
    }

    const carrierDbName = CARRIER_DB_NAME[carrier] ?? carrier

    // 步骤1: 数据转换（状态映射、日期格式化、物流公司写入）
    // 只保留 order_shipment 表中存在的字段
    const transformedRows: Record<string, unknown>[] = rows.map((row) => {
      let status = row.shipment_status
      // HH Express 特殊处理：状态可能含 ` / ` 分隔符，取最后一段
      if (carrier === 'hh' && typeof status === 'string' && status.includes(' / ')) {
        const parts = status.split(' / ')
        status = parts[parts.length - 1].trim()
      }
      
      // 只提取数据库表中存在的字段
      return {
        tracking_no: row.tracking_no,
        dest_tracking: row.dest_tracking,
        shipment_status: toShipmentStatus(status, carrierDbName),
        carrier: carrierDbName,
        // dispatch_date 仅在存在时添加
        ...(row.dispatch_date ? { dispatch_date: toDateStr(row.dispatch_date) } : {}),
      }
    })

    const trackingNos = transformedRows.map((r) => r.tracking_no as string).filter(Boolean)

    // 步骤2: 通过 tracking_no 匹配并更新
    const CHUNK = 100
    const dbMap = new Map<string, { tracking_no: string; transaction_id: string }>()
    
    // 批量查询已存在的记录
    for (let i = 0; i < trackingNos.length; i += CHUNK) {
      const chunk = trackingNos.slice(i, i + CHUNK)
      const { data } = await supabase
        .from('order_shipment')
        .select('tracking_no, transaction_id')
        .in('tracking_no', chunk)
      for (const r of data ?? []) {
        dbMap.set(r.tracking_no, r)
      }
    }

    // 分离匹配和未匹配的记录
    const matchedRows: Record<string, unknown>[] = []
    const unmatchedRows: Record<string, unknown>[] = []
    
    for (const row of transformedRows) {
      const trackingNo = row.tracking_no as string
      if (trackingNo && dbMap.has(trackingNo)) {
        matchedRows.push(row)
      } else {
        unmatchedRows.push(row)
      }
    }

    // 批量更新匹配的记录
    let updated = 0
    if (matchedRows.length > 0) {
      for (let i = 0; i < matchedRows.length; i += CHUNK) {
        const batch = matchedRows.slice(i, i + CHUNK)
        const { error } = await supabase
          .from('order_shipment')
          .upsert(batch, { onConflict: 'tracking_no' })
        if (error) {
          console.error('Upsert error:', error)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }
        updated += batch.length
      }
    }

    // 未匹配记录尝试用 dest_tracking 二次匹配
    let fixedCount = 0
    const finalUnmatched: string[] = []
    
    if (unmatchedRows.length > 0) {
      const destTrackingNos = unmatchedRows.map((r) => r.dest_tracking as string).filter(Boolean)
      const destMap = new Map<string, string>()
      
      for (let i = 0; i < destTrackingNos.length; i += CHUNK) {
        const chunk = destTrackingNos.slice(i, i + CHUNK)
        const { data } = await supabase
          .from('order_shipment')
          .select('tracking_no, dest_tracking')
          .in('dest_tracking', chunk)
        for (const r of data ?? []) {
          destMap.set(r.dest_tracking, r.tracking_no)
        }
      }
      
      for (const row of unmatchedRows) {
        const destTracking = row.dest_tracking as string
        if (destTracking && destMap.has(destTracking)) {
          const trackingNo = destMap.get(destTracking)!
          row.tracking_no = trackingNo
          matchedRows.push(row)
          fixedCount++
        } else {
          finalUnmatched.push(row.tracking_no as string)
        }
      }
      
      // 更新二次匹配成功的记录
      if (fixedCount > 0) {
        const fixedRows = matchedRows.slice(-fixedCount)
        for (let i = 0; i < fixedRows.length; i += CHUNK) {
          const batch = fixedRows.slice(i, i + CHUNK)
          await supabase
            .from('order_shipment')
            .upsert(batch, { onConflict: 'tracking_no' })
        }
        updated += fixedCount
      }
    }

    // 生成异常记录文件
    let unmatchedFilePath: string | null = null
    if (finalUnmatched.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `${carrierDbName}_unmatched_${timestamp}.csv`
      const dataImportDir = path.join(process.cwd(), '..', 'Data Import')
      
      // 确保目录存在
      if (!fs.existsSync(dataImportDir)) {
        fs.mkdirSync(dataImportDir, { recursive: true })
      }
      
      unmatchedFilePath = path.join(dataImportDir, filename)
      
      // 写入 CSV 文件
      const csvHeader = 'tracking_no'
      const csvRows = finalUnmatched.map(tn => `${tn}`)
      const csvContent = [csvHeader, ...csvRows].join('\n')
      fs.writeFileSync(unmatchedFilePath, csvContent, 'utf-8')
    }

    return NextResponse.json({
      updated,
      fixedCount,
      unmatchedTrackingNos: finalUnmatched,
      unmatchedFilePath,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}