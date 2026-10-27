'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { TopupRecord } from '@/lib/types'

type SortDir = 'asc' | 'desc'

const HEADER_SORT: Record<string, keyof TopupRecord | null> = {
  'Date':                     'date_received',
  'Amount Transferred (USD)': 'amount_transferred',
  'Amount Received (USD)':    'amount_received',
  'Difference':               'difference',
}

const HEADERS = Object.keys(HEADER_SORT)

interface Props {
  initialRecords: TopupRecord[]
  currentParams: { from?: string; to?: string }
}

export function TopupTable({ initialRecords, currentParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [from, setFrom] = useState(currentParams.from ?? '')
  const [to, setTo] = useState(currentParams.to ?? '')
  const [sortKey, setSortKey] = useState<keyof TopupRecord | null>('date_received')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(h: string) {
    const key = HEADER_SORT[h]
    if (!key) return
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return initialRecords
    return [...initialRecords].sort((a, b) => {
      const av = (a[sortKey] as string | number) ?? ''
      const bv = (b[sortKey] as string | number) ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [initialRecords, sortKey, sortDir])

  function applyFilters() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function exportTopup() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    window.open(`/api/export-topup?${params.toString()}`, '_blank')
  }

  const totalTransferred = initialRecords.reduce((s, r) => s + (r.amount_transferred ?? 0), 0)
  const totalReceived = initialRecords.reduce((s, r) => s + (r.amount_received ?? 0), 0)
  const totalDiff = initialRecords.reduce((s, r) => s + (r.difference ?? 0), 0)

  function fmt(n: number | null) {
    return n != null ? n.toFixed(2) : '—'
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Top-ups', value: initialRecords.length.toLocaleString() },
          { label: 'Total Transferred (USD)', value: `$${totalTransferred.toFixed(2)}` },
          { label: 'Total Received (USD)', value: `$${totalReceived.toFixed(2)}` },
          { label: 'Total Difference', value: `$${totalDiff.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold mt-1 text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-end bg-white p-4 rounded-lg border">
        <div>
          <p className="text-xs text-gray-500 mb-1">From</p>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">To</p>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700" />
        </div>
        <button onClick={applyFilters} disabled={isPending}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isPending ? 'Loading…' : 'Apply'}
        </button>
        <button onClick={exportTopup}
          className="border px-4 py-1.5 rounded text-sm hover:bg-gray-50 ml-auto transition-colors">
          ⬇ Download Excel
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border">
          No top-up records found for the selected period.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="border-b bg-gray-50">
                {HEADERS.map(h => {
                  const key = HEADER_SORT[h]
                  const isActive = sortKey === key
                  return (
                    <th key={h} onClick={() => handleSort(h)}
                      className={`p-3 text-left text-xs font-medium whitespace-nowrap select-none ${
                        key ? 'cursor-pointer hover:text-gray-800 hover:bg-gray-100' : 'cursor-default'
                      } ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                      {h}
                      {key && (
                        <span className="ml-1 inline-block w-3 text-center">
                          {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((record, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-sm whitespace-nowrap">
                    {record.date_received?.slice(0, 10) ?? '—'}
                  </td>
                  <td className="p-3 text-right text-sm">{fmt(record.amount_transferred)}</td>
                  <td className="p-3 text-right text-sm">{fmt(record.amount_received)}</td>
                  <td className={`p-3 text-right text-sm ${
                    (record.difference ?? 0) > 0 ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {fmt(record.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
