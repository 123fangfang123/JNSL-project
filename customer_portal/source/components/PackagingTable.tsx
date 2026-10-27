'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { PackagingItem } from '@/lib/types'
import { PackagingRow } from './PackagingRow'

type SortDir = 'asc' | 'desc'

const HEADER_SORT: Record<string, keyof PackagingItem | null> = {
  'PO Date':        'po_date',
  'Packaging Name': 'packaging_name',
  'Qty':            'qty',
  'Billing Date':   'billing_date',
  'USD Amount':     'usd_amt',
  'Remarks':        null,
}

const HEADERS = Object.keys(HEADER_SORT)

interface Props {
  initialItems: PackagingItem[]
  stores: string[]
  currentParams: { from?: string; to?: string; store?: string; q?: string }
}

export function PackagingTable({ initialItems, stores, currentParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [from, setFrom] = useState(currentParams.from ?? '')
  const [to, setTo] = useState(currentParams.to ?? '')
  const [store, setStore] = useState(currentParams.store ?? '')
  const [q, setQ] = useState(currentParams.q ?? '')
  const [sortKey, setSortKey] = useState<keyof PackagingItem | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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
    if (!sortKey) return initialItems
    return [...initialItems].sort((a, b) => {
      const av = (a[sortKey] as string | number) ?? ''
      const bv = (b[sortKey] as string | number) ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [initialItems, sortKey, sortDir])

  function applyFilters() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (store) params.set('store', store)
    if (q) params.set('q', q)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function exportItems() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (store) params.set('store', store)
    if (q) params.set('q', q)
    window.open(`/api/export-packaging?${params.toString()}`, '_blank')
  }

  const totalCostUsd = initialItems.reduce((s, i) => s + (i.usd_amt ?? 0), 0)
  const unbilledCount = initialItems.filter(i => !i.billing_date).length

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Items', value: initialItems.length.toLocaleString() },
          { label: 'Total Cost (USD)', value: `$${totalCostUsd.toFixed(2)}` },
          { label: 'Unbilled', value: unbilledCount.toLocaleString() },
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
        <div>
          <p className="text-xs text-gray-500 mb-1">Store</p>
          <select value={store} onChange={e => setStore(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700">
            <option value="">All Stores</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Search</p>
          <input type="text" placeholder="Packaging name…" value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            className="border rounded px-2 py-1.5 text-sm text-gray-700 w-44" />
        </div>
        <button onClick={applyFilters} disabled={isPending}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isPending ? 'Loading…' : 'Apply'}
        </button>
        <button onClick={exportItems}
          className="border px-4 py-1.5 rounded text-sm hover:bg-gray-50 ml-auto transition-colors">
          ⬇ Download Excel
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border">
          No packaging records found for the selected period.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-8 p-3" />
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
              {sorted.map((item, i) => (
                <PackagingRow key={`${item.po_date}-${i}`} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
