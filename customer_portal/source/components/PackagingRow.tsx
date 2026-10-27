'use client'

import { useState } from 'react'
import type { PackagingItem } from '@/lib/types'

function fmt(n: number | null | undefined) {
  return n != null ? n.toFixed(2) : '—'
}

export function PackagingRow({ item }: { item: PackagingItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        onClick={() => setExpanded(e => !e)}
        className={`border-b cursor-pointer hover:bg-gray-50 transition-colors ${
          expanded ? 'bg-blue-50' : ''
        }`}
      >
        <td className="p-3 text-gray-400 text-xs select-none">
          {expanded ? '▼' : '▶'}
        </td>
        <td className="p-3 text-sm whitespace-nowrap">{item.po_date?.slice(0, 10) ?? '—'}</td>
        <td className="p-3 text-sm">{item.packaging_name ?? '—'}</td>
        <td className="p-3 text-right text-sm">{item.qty ?? '—'}</td>
        <td className="p-3 text-sm whitespace-nowrap">
          {item.billing_date ? (
            item.billing_date.slice(0, 10)
          ) : (
            <span className="text-amber-600 font-medium text-xs">Bill Pending</span>
          )}
        </td>
        <td className="p-3 text-right text-sm">{fmt(item.usd_amt)}</td>
        <td className="p-3 text-sm text-gray-500">{item.remarks ?? '—'}</td>
      </tr>

      {expanded && (
        <tr className="border-b bg-blue-50">
          <td colSpan={7} className="px-10 py-4">
            <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">
              Cost Details
            </p>
            <dl className="grid grid-cols-3 gap-x-10 gap-y-3 text-xs">
              <div>
                <dt className="font-bold text-gray-600 mb-0.5">Unit Price (CNY)</dt>
                <dd className="text-gray-700">{fmt(item.unit_price_cny)}</dd>
              </div>
              <div>
                <dt className="font-bold text-gray-600 mb-0.5">Total Cost (CNY)</dt>
                <dd className="text-gray-700">{fmt(item.total_cost_cny)}</dd>
              </div>
              <div>
                <dt className="font-bold text-gray-600 mb-0.5">Exchange Rate</dt>
                <dd className="text-gray-700">{item.exchange_rate_used ?? '—'}</dd>
              </div>
            </dl>
          </td>
        </tr>
      )}
    </>
  )
}
