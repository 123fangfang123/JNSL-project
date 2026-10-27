'use client'

import { useState, useMemo } from 'react'
import type { StockItem } from '@/lib/types'

type SortDir = 'asc' | 'desc'

const HEADER_SORT: Record<string, keyof StockItem | null> = {
  'Product Name':      'sku_name',
  'Qty':               'qty',
  'Unit Price (USD)':  'unit_price_usd',
  'Stock Value (USD)': 'stock_value_usd',
  'Last Updated':      'snapshot_at',
}

const HEADERS = Object.keys(HEADER_SORT)

interface Props {
  initialItems: StockItem[]
}

export function StockTable({ initialItems }: Props) {
  const [q, setQ] = useState('')
  const [sortKey, setSortKey] = useState<keyof StockItem | null>('sku_name')
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

  const filtered = useMemo(() => {
    if (!q) return initialItems
    const lq = q.toLowerCase()
    return initialItems.filter(i =>
      i.sku_name?.toLowerCase().includes(lq) || i.sku.toLowerCase().includes(lq)
    )
  }, [initialItems, q])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] as string | number) ?? ''
      const bv = (b[sortKey] as string | number) ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const totalQty = initialItems.reduce((s, i) => s + (i.qty ?? 0), 0)
  const totalValue = initialItems.reduce((s, i) => s + (i.stock_value_usd ?? 0), 0)

  function fmt(n: number | null) {
    return n != null ? n.toFixed(2) : '—'
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total SKUs', value: initialItems.length.toLocaleString() },
          { label: 'Total Qty', value: totalQty.toLocaleString() },
          { label: 'Total Stock Value (USD)', value: `$${totalValue.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold mt-1 text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-end bg-white p-4 rounded-lg border">
        <div>
          <p className="text-xs text-gray-500 mb-1">Search</p>
          <input type="text" placeholder="Product name…" value={q}
            onChange={e => setQ(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700 w-52" />
        </div>
        <button onClick={() => window.open('/api/export-stock', '_blank')}
          className="border px-4 py-1.5 rounded text-sm hover:bg-gray-50 ml-auto transition-colors">
          ⬇ Download Excel
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border">
          No stock records found.
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
              {sorted.map((item) => (
                <tr key={item.sku} className="border-b hover:bg-gray-50">
                  <td className="p-3 text-sm">{item.sku_name ?? '—'}</td>
                  <td className="p-3 text-right text-sm">{item.qty}</td>
                  <td className="p-3 text-right text-sm">{fmt(item.unit_price_usd)}</td>
                  <td className="p-3 text-right font-bold text-sm">{fmt(item.stock_value_usd)}</td>
                  <td className="p-3 text-sm whitespace-nowrap text-gray-500">
                    {item.snapshot_at?.slice(0, 10) ?? '—'}
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
