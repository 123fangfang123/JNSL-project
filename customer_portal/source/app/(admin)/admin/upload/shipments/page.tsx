'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { applyColumnMap, detectMappedColumns } from '@/lib/admin/apply-column-map'
import { COLUMN_MAPS_BY_KEY, CARRIER_IDENTIFIERS, CARRIERS } from '@/lib/admin/carrier-configs/carrier-shipment-config'
import { MappingPreview } from '@/components/admin/MappingPreview'
import { NavigationGuard } from '@/components/admin/NavigationGuard'

type Carrier = 'yunexpress' | 'yanwen' | 'hh' | 'xj'
type Step = 'idle' | 'mapping' | 'uploading' | 'done' | 'error'

interface ImportResult {
  updated: number
  fixedCount: number
  unmatchedTrackingNos: string[]
  unmatchedFilePath?: string
}

const COLUMN_MAPS = COLUMN_MAPS_BY_KEY as Record<Carrier, Record<string, string | string[]>>

const DB_NAME_TO_KEY: Record<string, Carrier> = Object.fromEntries(
  CARRIERS.map(c => [c.dbName, c.key as Carrier])
)

/**
 * 基于 Excel 表头关键字自动识别物流商（与 CLI 逻辑一致）
 * 按照配置文件中关键字的优先级顺序匹配，而不是按照 Excel 表头的顺序
 */
function detectCarrier(headers: string[]): Carrier | null {
  const headersStr = headers.join(' ')
  
  // 按照配置文件中定义的顺序遍历关键字
  // 优先级：燕文 > 云途 > HH > 雄九
  // 注意：燕文和雄九都有"转单号"，但燕文的"流水号"和雄九的"专线单号"是各自独有的
  for (const [keyword, dbName] of Object.entries(CARRIER_IDENTIFIERS)) {
    if (headers.includes(keyword) || headersStr.includes(keyword)) {
      const carrierKey = DB_NAME_TO_KEY[dbName]
      if (carrierKey) {
        console.log(`[Shipments] 识别到物流商: ${dbName} (关键字: ${keyword})`)
        return carrierKey
      }
    }
  }
  
  console.warn(`[Shipments] 无法识别物流商，表头: ${headers.join(', ')}`)
  return null
}

export default function UploadShipmentsPage() {
  const [carrier, setCarrier] = useState<Carrier>('yunexpress')
  const [step, setStep] = useState<Step>('idle')
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mappedRows, setMappedRows] = useState<Record<string, unknown>[]>([])
  const [mappedCols, setMappedCols] = useState<Array<{ source: string; db: string }>>([])
  const [unmappedCols, setUnmappedCols] = useState<string[]>([])
    const [result, setResult] = useState<ImportResult | null>(null)
  const [detectedCarrier, setDetectedCarrier] = useState<Carrier | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')

  // 导入过程中阻止页面切换
  useEffect(() => {
    if (step === 'uploading') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = '运单正在导入中，确定要离开吗？'
        return '运单正在导入中，确定要离开吗？'
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
      const wb = XLSX.read(data, { type: 'array', raw: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      if (rows.length === 0) { setError('文件为空'); return }
      const headers = Object.keys(rows[0])

      const detected = detectCarrier(headers)
      if (!detected) {
        setError('无法自动识别物流商，请确认文件来自以下物流商：YUNExpress / YANWEN / HH Express / XJ Logistics')
        return
      }
      setCarrier(detected)
      setDetectedCarrier(detected)

      const colMap = COLUMN_MAPS[detected]
      const { mapped, unmapped } = detectMappedColumns(headers, colMap as Record<string, string>)
      setRawRows(rows)
      setMappedCols(mapped)
      setUnmappedCols(unmapped)
      setError(null)
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  function handleMappingConfirm() {
    const colMap = COLUMN_MAPS[carrier]
    let { rows } = applyColumnMap(rawRows, colMap as Record<string, string>)

    // 展开数组映射：一个 Excel 列 → 多个 DB 字段（如雄九「转单号」→ tracking_no + dest_tracking）
    rows = rows.map((row) => {
      const expanded = { ...row }
      for (const [sourceKey, dbField] of Object.entries(colMap)) {
        if (Array.isArray(dbField) && row[sourceKey] != null) {
          for (const field of dbField) {
            expanded[field] = row[sourceKey]
          }
        }
      }
      return expanded
    })

    // YUNExpress 客户单号可能含后缀（如 "6955831787769_D001"），去掉 "_D" 及之后部分
    if (carrier === 'yunexpress') {
      rows = rows.map((r) => ({
        ...r,
        transaction_id: r.transaction_id != null
          ? String(r.transaction_id).replace(/_D.*$/, '')
          : r.transaction_id,
      }))
    }

    setMappedRows(rows)
    upload(rows)
  }

  async function upload(rows: Record<string, unknown>[]) {
    setStep('uploading')
    setUploadProgress('')
    try {
      const res = await fetch('/api/admin/upload/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, carrier }),
      })
      let json: Record<string, unknown>
      try { json = await res.json() } catch {
        setError('服务器错误 (HTTP ' + res.status + ')')
        setStep('error')
        return
      }
      if (!res.ok) { setError(String(json.error ?? '导入失败')); setStep('error'); return }

      setResult(json as unknown as ImportResult)
      setStep('done')
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function reset() {
    setStep('idle'); setRawRows([]); setMappedRows([])
    setResult(null); setError(null); setUploadProgress('')
  }

  return (
    <div className="p-6 max-w-2xl">
      <NavigationGuard active={step === 'uploading'} />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">导入物流商运单</h1>
      <p className="text-sm text-gray-500 mb-6">
        从物流公司系统导出的 Excel 文件中批量更新运单信息。仅更新已存在的运单记录，不创建新记录。
      </p>

      {(step === 'idle' || step === 'error') && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            物流商（自动识别）：YUNExpress / YANWEN / HH Express / XJ Logistics
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-4 text-sm">选择 Excel (.xls, .xlsx) 文件</p>
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFile}
              className="block mx-auto text-sm"
              key={step === 'error' ? 'retry' : 'idle'}
            />
            {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
          </div>
        </div>
      )}

      {step === 'uploading' && (
        <div className="p-8 text-center text-gray-500 text-sm">
          {uploadProgress || (carrier ? `${CARRIERS.find(c => c.key === carrier)?.displayName ?? carrier} - 导入中…` : '导入中…')}
        </div>
      )}

      {step === 'done' && result && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg space-y-3">
          <p className="font-semibold text-green-700">导入完成</p>
          <div className="text-sm space-y-1">
            <p className="text-green-600">
              通过 tracking_no 匹配更新: <span className="font-semibold">{result.updated}</span> 条
            </p>
            {result.fixedCount > 0 && (
              <p className="text-blue-600">
                修复错误记录（dest_tracking 二次匹配）: <span className="font-semibold">{result.fixedCount}</span> 条
              </p>
            )}
            {result.unmatchedTrackingNos.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs font-semibold text-yellow-700 mb-2">
                  ⚠️ {result.unmatchedTrackingNos.length} 条运单未匹配（已跳过）
                </p>
                <div className="max-h-32 overflow-y-auto">
                  <ul className="text-xs text-yellow-600 space-y-0.5 font-mono">
                    {result.unmatchedTrackingNos.slice(0, 100).map((tn, i) => (
                      <li key={i}>{tn}</li>
                    ))}
                    {result.unmatchedTrackingNos.length > 100 && (
                      <li className="text-yellow-500 italic">…及其他 {result.unmatchedTrackingNos.length - 100} 条</li>
                    )}
                  </ul>
                </div>
                {result.unmatchedFilePath && (
                  <p className="mt-2 text-xs text-yellow-700 font-mono">
                    📄 异常记录已保存: {result.unmatchedFilePath}
                  </p>
                )}
              </div>
            )}
          </div>
          <button onClick={reset} className="mt-4 text-sm text-green-700 underline">继续导入其他文件</button>
        </div>
      )}

      {step === 'mapping' && (
        <>
          {detectedCarrier && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                自动识别物流商: <span className="font-semibold">{CARRIERS.find(c => c.key === detectedCarrier)?.displayName ?? detectedCarrier}</span>
              </p>
            </div>
          )}
          <MappingPreview
            mapped={mappedCols}
            unmapped={unmappedCols}
            onConfirm={handleMappingConfirm}
            onCancel={reset}
          />
        </>
      )}

      </div>
  )
}