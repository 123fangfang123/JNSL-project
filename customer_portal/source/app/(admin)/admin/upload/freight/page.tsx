'use client'
import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { applyColumnMap, detectMappedColumns } from '@/lib/admin/apply-column-map'
import { MappingPreview } from '@/components/admin/MappingPreview'
import { NavigationGuard } from '@/components/admin/NavigationGuard'
import FREIGHT_BILL_CONFIG from '@/lib/admin/carrier-configs/freight-bill-config'

type Step = 'idle' | 'mapping' | 'uploading' | 'done' | 'error'
type CarrierId = 'yunexpress' | 'yanwen' | 'hh' | 'xj' | 'gc'

const CARRIER_DB_NAME: Record<CarrierId, string> = {
  yunexpress: 'YUNExpress',
  yanwen: 'YANWEN',
  hh: 'HH EXPRESS',
  xj: 'XJ LOGISTICS',
  gc: 'GC'
}

const DB_NAME_TO_KEY: Record<string, CarrierId> = Object.fromEntries(
  Object.entries(CARRIER_DB_NAME).map(([k, v]) => [v, k as CarrierId])
)

const CARRIERS: Array<{ id: CarrierId; label: string; map: Record<string, string> }> = [
  { id: 'yunexpress', label: 'YUNExpress', map: FREIGHT_BILL_CONFIG.CARRIER_COLUMN_MAPS['YUNExpress'] },
  { id: 'yanwen', label: 'YANWEN', map: FREIGHT_BILL_CONFIG.CARRIER_COLUMN_MAPS['YANWEN'] },
  { id: 'hh', label: 'HH Express', map: FREIGHT_BILL_CONFIG.CARRIER_COLUMN_MAPS['HH EXPRESS'] },
  { id: 'xj', label: 'XJ Logistics', map: FREIGHT_BILL_CONFIG.CARRIER_COLUMN_MAPS['XJ LOGISTICS'] },
  { id: 'gc', label: 'GC (易可达)', map: FREIGHT_BILL_CONFIG.CARRIER_COLUMN_MAPS['GC'] },
]

/**
 * 基于 Excel 表头关键字自动识别物流商（与 CLI 逻辑一致）
 * 按照配置文件中关键字的优先级顺序匹配，而不是按照 Excel 表头的顺序
 */
function detectFreightCarrier(headers: string[]): CarrierId | null {
  const identifiers = FREIGHT_BILL_CONFIG.CARRIER_IDENTIFIERS
  const headersStr = headers.join(' ')
  
  // 按照配置文件中定义的顺序遍历关键字
  // 这样燕文的关键字（账单日期、账单金额）会在雄九的关键字（转单号）之前被检查
  for (const [keyword, carrierName] of Object.entries(identifiers)) {
    if (headers.includes(keyword) || headersStr.includes(keyword)) {
      const carrierKey = DB_NAME_TO_KEY[carrierName]
      if (carrierKey) {
        console.log(`[Freight] 识别到物流商: ${carrierName} (关键字: ${keyword})`)
        return carrierKey
      }
    }
  }
  
  console.warn(`[Freight] 无法识别物流商，表头: ${headers.join(', ')}`)
  return null
}

export default function UploadFreightPage() {
  const [carrier, setCarrier] = useState<CarrierId | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mappedRows, setMappedRows] = useState<Record<string, unknown>[]>([])
  const [mappedCols, setMappedCols] = useState<Array<{ source: string; db: string }>>([])
  const [unmappedCols, setUnmappedCols] = useState<string[]>([])
  const [result, setResult] = useState<{ 
    inserted: number; 
    updated: number; 
    skipped: number;
    logFile?: string;
    updatedTrackingNos?: string[];
    errors?: string[];
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detectedCarrier, setDetectedCarrier] = useState<CarrierId | null>(null)

  // 导入过程中阻止页面切换
  useEffect(() => {
    if (step === 'uploading') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = '运费正在导入中，确定要离开吗？'
        return '运费正在导入中，确定要离开吗？'
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [step])

  const selectedCarrier = CARRIERS.find((c) => c.id === carrier)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array', raw: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

        if (rows.length === 0) {
          setError('文件为空')
          return
        }

        const headers = Object.keys(rows[0])

        // 自动识别物流商
        const detected = detectFreightCarrier(headers)
        if (!detected) {
          setError('无法自动识别物流商，请确认文件来自以下物流商：YUNExpress / YANWEN / HH Express / XJ Logistics')
          return
        }

        setCarrier(detected)
        setDetectedCarrier(detected)

        const selectedCarrier = CARRIERS.find(c => c.id === detected)!
        const { mapped, unmapped } = detectMappedColumns(headers, selectedCarrier.map)
        setRawRows(rows)
        setMappedCols(mapped)
        setUnmappedCols(unmapped)
        setStep('mapping')
      } catch (err) {
        setError(`解析文件失败：${String(err)}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleMappingConfirm() {
    if (!selectedCarrier) return
    const { rows } = applyColumnMap(rawRows, selectedCarrier.map)
    setMappedRows(rows)
    upload(rows)
  }

  async function upload(rows: Record<string, unknown>[]) {
    setStep('uploading')
    try {
      const res = await fetch('/api/admin/upload/freight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, carrier }),
      })
      let json: Record<string, unknown>
      try {
        json = await res.json()
      } catch {
        setError(`服务器错误 (HTTP ${res.status})`)
        setStep('error')
        return
      }
      if (!res.ok) {
        setError(String(json.error ?? '导入失败'))
        setStep('error')
        return
      }
      setResult(json as { inserted: number; updated: number; skipped: number })
      setStep('done')
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function reset() {
    setStep('idle')
    setRawRows([])
    setMappedRows([])
    setResult(null)
    setError(null)
    setCarrier(null)
    setDetectedCarrier(null)
  }

  return (
    <div className="p-6 max-w-2xl">
      <NavigationGuard active={step === 'uploading'} />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">导入运费账单</h1>
      <p className="text-sm text-gray-500 mb-6">
        v2.9 三路分支逻辑：同一运单号多条记录费用自动相加合并；已存在且费用不同的记录费用相加更新，费用相同跳过。
      </p>

      <p className="text-sm text-gray-700 mb-4">
        物流商（自动识别）：YUNExpress / YANWEN / HH Express / XJ Logistics
      </p>

      {(step === 'idle' || step === 'error') && (
        <div className="space-y-4">
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
          {carrier ? `${CARRIERS.find(c => c.id === carrier)?.label ?? carrier} - 导入中…` : '导入中…'}
        </div>
      )}

      {step === 'done' && result && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg space-y-3">
          <p className="font-semibold text-green-700">导入完成</p>
          <div className="text-sm space-y-1">
            {result.inserted > 0 && (
              <p className="text-green-600">
                新增运费记录: <span className="font-semibold">{result.inserted}</span> 条
              </p>
            )}
            {result.updated > 0 && (
              <p className="text-blue-600">
                费用相加更新: <span className="font-semibold">{result.updated}</span> 条
              </p>
            )}
            {result.skipped > 0 && (
              <p className="text-gray-500">
                费用相同跳过: <span className="font-semibold">{result.skipped}</span> 条
              </p>
            )}
          </div>
          
          {result.updatedTrackingNos && result.updatedTrackingNos.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-semibold text-blue-700 mb-2">费用相加更新的运单号:</p>
              <div className="text-xs text-blue-600 space-y-1 max-h-32 overflow-y-auto">
                {result.updatedTrackingNos.map((tn, idx) => (
                  <p key={idx}>{idx + 1}. {tn}</p>
                ))}
              </div>
            </div>
          )}
          
          {result.errors && result.errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm font-semibold text-red-700 mb-2">错误信息:</p>
              <div className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <p key={idx}>{idx + 1}. {err}</p>
                ))}
              </div>
            </div>
          )}
          
          {result.logFile && (
            <div className="mt-3 text-xs text-gray-500">
              <p>📝 日志文件: <span className="font-mono">{result.logFile}</span></p>
            </div>
          )}
          
          <button onClick={reset} className="mt-4 text-sm text-green-700 underline">
            继续导入其他文件
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <>
          {detectedCarrier && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                自动识别物流商：<span className="font-semibold">{CARRIERS.find(c => c.id === detectedCarrier)?.label ?? detectedCarrier}</span>
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
