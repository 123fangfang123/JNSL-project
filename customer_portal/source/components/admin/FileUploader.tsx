'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { applyColumnMap, detectMappedColumns } from '@/lib/admin/apply-column-map'
import { MappingPreview } from './MappingPreview'
import { ConflictModal } from './ConflictModal'

interface Props {
  title: string
  apiPath: string
  columnMap: Record<string, string>
  onSuccess?: (result: UploadResult) => void
}

interface UploadResult {
  inserted: number
  updated: number
  message?: string
}

type Step = 'idle' | 'mapping' | 'conflict' | 'uploading' | 'done' | 'error'

export function FileUploader({ title, apiPath, columnMap, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mappedRows, setMappedRows] = useState<Record<string, unknown>[]>([])
  const [mappedCols, setMappedCols] = useState<Array<{ source: string; db: string }>>([])
  const [unmappedCols, setUnmappedCols] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      if (rows.length === 0) { setError('File is empty or could not be parsed.'); return }
      const headers = Object.keys(rows[0])
      const { mapped, unmapped } = detectMappedColumns(headers, columnMap)
      setRawRows(rows)
      setMappedCols(mapped)
      setUnmappedCols(unmapped)
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleMappingConfirm() {
    const { rows } = applyColumnMap(rawRows, columnMap)
    setMappedRows(rows)
    await upload(rows, false)
  }

  async function handleConflictConfirm() {
    await upload(mappedRows, true)
  }

  async function upload(rows: Record<string, unknown>[], overwrite: boolean) {
    setStep('uploading')
    setError(null)
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, overwrite }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Upload failed'); setStep('error'); return }
      if (json.duplicates?.length > 0 && !overwrite) {
        setDuplicates(json.duplicates)
        setStep('conflict')
        return
      }
      setResult(json)
      setStep('done')
      onSuccess?.(json)
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function reset() {
    setStep('idle')
    setRawRows([])
    setMappedRows([])
    setDuplicates([])
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

      {(step === 'idle' || step === 'error') && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-4 text-sm">Select an Excel (.xlsx) file to upload</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            className="block mx-auto text-sm"
          />
          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
            </p>
          )}
        </div>
      )}

      {step === 'uploading' && (
        <div className="p-8 text-center text-gray-500 text-sm">Uploading…</div>
      )}

      {step === 'done' && result && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold text-green-700 mb-1">Upload complete</p>
          <p className="text-sm text-green-600">
            {result.inserted} inserted, {result.updated} updated
            {result.message ? ` — ${result.message}` : ''}
          </p>
          <button onClick={reset} className="mt-4 text-sm text-green-700 underline">
            Upload another file
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <MappingPreview
          mapped={mappedCols}
          unmapped={unmappedCols}
          onConfirm={handleMappingConfirm}
          onCancel={reset}
        />
      )}

      {step === 'conflict' && (
        <ConflictModal
          duplicates={duplicates}
          onConfirm={handleConflictConfirm}
          onCancel={reset}
        />
      )}
    </div>
  )
}
