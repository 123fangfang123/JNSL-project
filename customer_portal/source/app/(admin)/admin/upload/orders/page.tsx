'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { applyColumnMap, detectMappedColumns } from '@/lib/admin/apply-column-map'
import { ordersColumnMap } from '@/lib/admin/column-maps/orders'
import { mapAbnormalCode } from '@/lib/admin/abnormal-code-map'
import { carrierZhToEn } from '@/lib/carrier-config'
import { MappingPreview } from '@/components/admin/MappingPreview'
import { AbnormalReview, AbnormalRowData } from '@/components/admin/AbnormalReview'
import { NavigationGuard } from '@/components/admin/NavigationGuard'

type Step = 'idle' | 'mapping' | 'abnormal_review' | 'carrier_confirm' | 'uploading' | 'done' | 'error'

export default function UploadOrdersPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mappedRows, setMappedRows] = useState<Record<string, unknown>[]>([])
  const [processedRows, setProcessedRows] = useState<Record<string, unknown>[]>([])
  const [mappedCols, setMappedCols] = useState<Array<{ source: string; db: string }>>([])
  const [unmappedCols, setUnmappedCols] = useState<string[]>([])
  const [abnormalRows, setAbnormalRows] = useState<AbnormalRowData[]>([])
  const [result, setResult] = useState<{ inserted: number; updated: number; itemsCount: number; shipmentsCount: number; skippedShipments: number; pricingCount: number; carrierWarnings: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkingCancellable, setCheckingCancellable] = useState(false)
  const [checkingReturned, setCheckingReturned] = useState(false)
  const [cancellableError, setCancellableError] = useState<string | null>(null)
  const [returnedError, setReturnedError] = useState<string | null>(null)
  const [unmappedCarriers, setUnmappedCarriers] = useState<string[]>([])

  // Prevent navigation during upload
  useEffect(() => {
    if (step === 'uploading') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = '订单正在导入中，确定要离开吗？'
        return '订单正在导入中，确定要离开吗？'
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [step])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      if (rows.length === 0) { setError('文件为空'); return }
      const headers = Object.keys(rows[0])
      const { mapped, unmapped } = detectMappedColumns(headers, ordersColumnMap)
      setRawRows(rows)
      setMappedCols(mapped)
      setUnmappedCols(unmapped)
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  function handleMappingConfirm() {
    const { rows } = applyColumnMap(rawRows, ordersColumnMap)

    // Validate required columns are mapped
    const REQUIRED_DB_FIELDS = [
      'transaction_id', 'order_number', 'store_name', 'sku', 'qty',
      'order_date', 'order_status', 'country', 'is_abnormal', 'abnormal_code',
      'order_total_value', 'order_ex_rate', 'product_name', 'item_id',
      'tracking_no', 'shipment_date', 'channel_id', 'dispatch_date',
    ]
    const mappedDbFields = new Set(mappedCols.map(m => m.db))
    const missingFields = REQUIRED_DB_FIELDS.filter(f => !mappedDbFields.has(f))
    if (missingFields.length > 0) {
      setError('缺少必需列: ' + missingFields.join(', '))
      setStep('error')
      return
    }

    setMappedRows(rows)

    // Build deduplicated order map for preview
    const seen = new Set<string>()
    const orderPreview: Array<{ tid: string; store: unknown; is_abnormal: boolean; abnormal_code: string; reason_raw: string; reason_missing: boolean }> = []
    for (const row of rows) {
      const tid = String(row.transaction_id ?? '')
      if (seen.has(tid)) continue
      seen.add(tid)
      const isAbnormal = String(row.is_abnormal ?? '').trim() === '是'
      const reasonRaw = String(row.abnormal_code ?? '').trim()
      
      // Auto-assign customer_request if abnormal order has no reason
      let abnormalCodeMapped = mapAbnormalCode(reasonRaw)
      let reasonMissing = false
      if (isAbnormal && !reasonRaw) {
        abnormalCodeMapped = 'customer_request'
        reasonMissing = true
      }
      
      orderPreview.push({
        tid,
        store: row.store_name,
        is_abnormal: isAbnormal,
        abnormal_code: abnormalCodeMapped,
        reason_raw: reasonRaw,
        reason_missing: reasonMissing,
      })
    }

    const abnormal = orderPreview
      .filter((o) => o.is_abnormal)
      .map((o) => ({
        transaction_id: o.tid,
        store_name: o.store,
        abnormal_code: o.abnormal_code,
        reason_raw: o.reason_raw,
        reason_missing: o.reason_missing,
      }))

    if (abnormal.length > 0) {
      setAbnormalRows(abnormal)
      setStep('abnormal_review')
    } else {
      // No abnormal orders — go directly to upload
      setProcessedRows(rows)
      upload(rows)
    }
  }


  const [abnormalOverrides, setAbnormalOverrides] = useState<Record<string, string>>({})

  function handleAbnormalConfirm(updatedAbnormal: AbnormalRowData[]) {
    const overrides: Record<string, string> = {}
    for (const r of updatedAbnormal) overrides[r.transaction_id] = r.abnormal_code
    setAbnormalOverrides(overrides)
    setProcessedRows(mappedRows)
    
    // 检查是否有未映射的物流公司
    const unmapped = checkUnmappedCarriers(mappedRows)
    if (unmapped.length > 0) {
      setUnmappedCarriers(unmapped)
      setStep('carrier_confirm')
    } else {
      upload(mappedRows, overrides)
    }
  }

  // 检查未映射的物流公司
  function checkUnmappedCarriers(rows: Record<string, unknown>[]): string[] {
    const unmapped = new Set<string>()
    for (const row of rows) {
      const carrierRaw = row.carrier
      if (carrierRaw != null && String(carrierRaw).trim()) {
        const carrierStr = String(carrierRaw).trim()
        // 检查是否在映射表中
        if (!carrierZhToEn[carrierStr]) {
          unmapped.add(carrierStr)
        }
      }
    }
    return Array.from(unmapped)
  }

  // 确认继续导入（有未映射物流公司时）
  function handleCarrierConfirm() {
    upload(mappedRows, abnormalOverrides)
  }

  // 取消导入（有未映射物流公司时）
  function handleCarrierCancel() {
    reset()
  }

  const [uploadProgress, setUploadProgress] = useState('')

  async function upload(rows: Record<string, unknown>[], overrides: Record<string, string> = {}) {
    setStep('uploading')
    setUploadProgress('')
    try {

      // Group rows by transaction_id, then build chunks that never split an order
      const orderGroups = new Map<string, Record<string, unknown>[]>()
      for (const row of rows) {
        const tid = String(row.transaction_id ?? '')
        if (!orderGroups.has(tid)) orderGroups.set(tid, [])
        orderGroups.get(tid)!.push(row)
      }
      const groups = Array.from(orderGroups.values())

      // Build chunks respecting order boundaries (target ~300 rows per chunk)
      const CHUNK = 300
      const chunks: Record<string, unknown>[][] = []
      let currentChunk: Record<string, unknown>[] = []
      for (const group of groups) {
        if (currentChunk.length + group.length > CHUNK && currentChunk.length > 0) {
          chunks.push(currentChunk)
          currentChunk = []
        }
        currentChunk.push(...group)
      }
      if (currentChunk.length > 0) chunks.push(currentChunk)

      let inserted = 0
      let updated = 0
      const allWarnings: string[] = []
      let totalItems = 0
      let totalShipments = 0
      let totalSkippedShipments = 0
      let totalPricing = 0
      const total = chunks.length
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunkNum = ci + 1
        if (total > 1) setUploadProgress(`上传中… (${chunkNum} / ${total})`)
        const res = await fetch('/api/admin/upload/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunks[ci], overwrite: true, abnormalOverrides: overrides }),
        })
        let json: Record<string, unknown>
        try { json = await res.json() } catch {
          setError(`服务器错误 (HTTP ${res.status}) 第 ${chunkNum}`)
          setStep('error'); return
        }
        if (!res.ok) { setError(String(json.error ?? '导入失败')); setStep('error'); return }
        inserted += (json.inserted as number) ?? 0
        updated += (json.updated as number) ?? 0
        allWarnings.push(...((json.carrierWarnings as string[]) ?? []))
        totalItems += (json.itemsCount as number) ?? 0
        totalShipments += (json.shipmentsCount as number) ?? 0
        totalSkippedShipments += (json.skippedShipments as number) ?? 0
        totalPricing += (json.pricingCount as number) ?? 0
      }
      setResult({ inserted, updated, itemsCount: totalItems, shipmentsCount: totalShipments, skippedShipments: totalSkippedShipments, pricingCount: totalPricing, carrierWarnings: allWarnings })
      setStep('done')
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function reset() {
    setStep('idle'); setRawRows([]); setMappedRows([]); setProcessedRows([])
    setAbnormalRows([]); setResult(null); setError(null); setUnmappedCarriers([])
  }

  async function checkCancellableOrders() {
    setCheckingCancellable(true)
    setCancellableError(null)
    try {
      const res = await fetch('/api/admin/check-cancellable-orders?page=1&pageSize=1')
      const json = await res.json()
      if (!res.ok) {
        setCancellableError(json.error || '检测失败')
      } else {
        const total = json.total || 0
        if (total === 0) {
          setCancellableError('没有符合条件的订单')
        } else {
          router.push('/admin/check-cancellable-orders')
        }
      }
    } catch (err) {
      setCancellableError(String(err))
    } finally {
      setCheckingCancellable(false)
    }
  }

  async function checkReturnedOrders() {
    setCheckingReturned(true)
    setReturnedError(null)
    try {
      const res = await fetch('/api/admin/check-returned-orders?page=1&pageSize=1')
      const json = await res.json()
      if (!res.ok) {
        setReturnedError(json.error || '检测失败')
      } else {
        const total = json.total || 0
        if (total === 0) {
          setReturnedError('没有符合条件的订单')
        } else {
          router.push('/admin/check-returned-orders')
        }
      }
    } catch (err) {
      setReturnedError(String(err))
    } finally {
      setCheckingReturned(false)
    }
  }

  return (
    <>
    <NavigationGuard active={step === 'uploading'} />
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">导入订单</h1>
      <p className="text-sm text-gray-500 mb-6">
        普通订单和异常订单可放在同一文件中，使用 <span className="font-mono">是否重发订单</span>列来区分
      </p>

      {(step === 'idle' || step === 'error') && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-4 text-sm">选择 Excel (.xls/.xlsx) 或 CSV 文件</p>
          <input type="file" accept=".xls,.xlsx,.csv" onChange={handleFile} className="block mx-auto text-sm" />
          {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        </div>
      )}

      {step === 'mapping' && (
        <MappingPreview
          inline
          mapped={mappedCols}
          unmapped={unmappedCols}
          onConfirm={handleMappingConfirm}
          onCancel={reset}
        />
      )}

      {step === 'abnormal_review' && (
        <AbnormalReview
          inline
          rows={abnormalRows}
          onConfirm={handleAbnormalConfirm}
          onCancel={reset}
        />
      )}

      {step === 'uploading' && (
        <div className="p-8 text-center text-gray-500 text-sm">
          {uploadProgress || '上传中…'}
        </div>
      )}
      {step === 'done' && result && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold text-green-700">导入完成</p>
          <p className="text-sm text-green-600">订单: {result.inserted} 条</p>
            <p className="text-xs text-green-500">商品明细: {result.itemsCount} 条 | 价格记录: {result.pricingCount} 条 | 物流记录: {result.shipmentsCount} 条{result.skippedShipments > 0 ? ` (跳过 ${result.skippedShipments} 条已有运单号)` : ''}</p>
          {result.carrierWarnings.length > 0 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs font-semibold text-yellow-700 mb-1">⚠️ {result.carrierWarnings.length} 个物流公司未识别（carrier 已设为 NULL）</p>
              <div className="max-h-24 overflow-y-auto">
                {result.carrierWarnings.map((w, i) => (
                  <p key={i} className="text-xs text-yellow-600">{w}</p>
                ))}
              </div>
            </div>
          )}
          <button onClick={reset} className="mt-4 text-sm text-green-700 underline">继续导入其他文件</button>
        </div>
      )}
      {step === 'carrier_confirm' && (
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-2">⚠️</span>
            <h3 className="text-lg font-semibold text-yellow-800">发现未映射的物流公司</h3>
          </div>
          <p className="text-sm text-yellow-700 mb-4">
            以下物流公司在配置文件中没有映射关系，导入后这些订单的 <code className="bg-yellow-100 px-1 rounded">carrier</code> 字段将设为 <code className="bg-yellow-100 px-1 rounded">NULL</code>：
          </p>
          <ul className="list-disc list-inside mb-4 bg-white p-3 rounded border border-yellow-200">
            {unmappedCarriers.map((carrier, i) => (
              <li key={i} className="text-sm text-yellow-800 font-mono">{carrier}</li>
            ))}
          </ul>
          <p className="text-xs text-yellow-600 mb-4">
            如需添加映射，请更新配置文件：<br />
            <code className="bg-yellow-100 px-1 rounded">tools/lib/admin/column-maps/ma-order-import-config.js</code><br />
            <code className="bg-yellow-100 px-1 rounded">source/lib/carrier-config.ts</code>
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCarrierConfirm}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
            >
              继续导入
            </button>
            <button
              onClick={handleCarrierCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 检测订单区域 */}
      <div className="mt-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">检测订单</h1>
        
        {/* 检测是否可作废的订单 */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-6 min-h-[120px]">
          <div className="mb-4">
            <span className="text-lg font-semibold text-gray-700">检测是否可作废的订单</span>
          </div>
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">点击"检测"按钮查询可作废订单</span>
            <button
              onClick={checkCancellableOrders}
              disabled={checkingCancellable || step === 'uploading'}
              className="ml-4 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {checkingCancellable ? '检测中...' : '检测'}
            </button>
          </div>
          {cancellableError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded">{cancellableError}</p>
          )}
        </div>

        {/* 检测是否已退货的订单 */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[120px]">
          <div className="mb-4">
            <span className="text-lg font-semibold text-gray-700">检测是否已退货的订单</span>
          </div>
          <div className="mt-4 text-center">
            <span className="text-sm text-gray-500">点击"检测"按钮查询已退货订单</span>
            <button
              onClick={checkReturnedOrders}
              disabled={checkingReturned || step === 'uploading'}
              className="ml-4 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {checkingReturned ? '检测中...' : '检测'}
            </button>
          </div>
          {returnedError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded">{returnedError}</p>
          )}
        </div>
      </div>

    </div>
    </>
  )
}
