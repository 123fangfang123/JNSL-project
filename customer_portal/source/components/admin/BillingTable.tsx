'use client'
import { useState } from 'react'

export interface BillingRow {
  transaction_id: string
  store_name: string | null
  order_date: string | null
  cog_cny: number
  freight_cny: number
  exchange_rate: number
  order_cny_value: number | null
  order_ex_rate: number | null
  cog_usd: number
  shipping_usd: number
  fulfillment_usd: number
  total_cost_usd: number
  _fulfillment_rate_source?: string // Debug info
}

interface Props {
  rows: BillingRow[]
  onChange: (rows: BillingRow[]) => void
}

export function BillingTable({ rows, onChange }: Props) {
  function update(index: number, field: keyof BillingRow, value: string) {
    const numValue = parseFloat(value) || 0
    const next = rows.map((row, i) => {
      if (i !== index) return row
      
      // Update the specific field
      const updatedRow = { ...row, [field]: numValue }
      
      // Recalculate total_cost_usd when cog_usd, shipping_usd, or fulfillment_usd changes
      if (field === 'cog_usd' || field === 'shipping_usd' || field === 'fulfillment_usd') {
        updatedRow.total_cost_usd = Math.round(
          ((updatedRow.cog_usd ?? 0) + (updatedRow.shipping_usd ?? 0) + (updatedRow.fulfillment_usd ?? 0)) * 100
        ) / 100
      }
      
      return updatedRow
    })
    onChange(next)
  }

  const totals = rows.reduce(
    (acc, r) => ({
      cog_usd: acc.cog_usd + r.cog_usd,
      shipping_usd: acc.shipping_usd + r.shipping_usd,
      fulfillment_usd: acc.fulfillment_usd + r.fulfillment_usd,
      total_cost_usd: acc.total_cost_usd + r.total_cost_usd,
    }),
    { cog_usd: 0, shipping_usd: 0, fulfillment_usd: 0, total_cost_usd: 0 }
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-600 text-left">
            <th className="px-3 py-2 border">Transaction ID</th>
            <th className="px-3 py-2 border">Store</th>
            <th className="px-3 py-2 border">Order Date</th>
            <th className="px-3 py-2 border text-right">Order CNY</th>
            <th className="px-3 py-2 border text-right">Order Rate</th>
            <th className="px-3 py-2 border text-right">COG CNY</th>
            <th className="px-3 py-2 border text-right">Freight CNY</th>
            <th className="px-3 py-2 border text-right">COG USD</th>
            <th className="px-3 py-2 border text-right">Shipping USD</th>
            <th className="px-3 py-2 border text-right">Fulfillment USD</th>
            <th className="px-3 py-2 border text-right bg-blue-50">Total Cost USD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.transaction_id} className="hover:bg-gray-50">
              <td className="px-3 py-2 border font-mono text-xs">{row.transaction_id}</td>
              <td className="px-3 py-2 border">{row.store_name ?? '—'}</td>
              <td className="px-3 py-2 border">{row.order_date ?? '—'}</td>
              <td className="px-3 py-2 border text-right text-gray-600">
                {row.order_cny_value != null ? row.order_cny_value.toFixed(2) : '—'}
              </td>
              <td className="px-3 py-2 border text-right text-gray-600">
                {row.order_ex_rate != null ? row.order_ex_rate.toFixed(4) : '—'}
              </td>
              <td className="px-3 py-2 border text-right text-gray-500">{row.cog_cny.toFixed(2)}</td>
              <td className="px-3 py-2 border text-right text-gray-500">{row.freight_cny.toFixed(2)}</td>
              <td className="px-3 py-2 border text-right">
                <input
                  type="number"
                  step="0.01"
                  value={row.cog_usd}
                  onChange={(e) => update(i, 'cog_usd', e.target.value)}
                  className="w-24 text-right border rounded px-1 py-0.5 text-sm"
                />
              </td>
              <td className="px-3 py-2 border text-right">
                <input
                  type="number"
                  step="0.01"
                  value={row.shipping_usd}
                  onChange={(e) => update(i, 'shipping_usd', e.target.value)}
                  className="w-24 text-right border rounded px-1 py-0.5 text-sm"
                />
              </td>
              <td className="px-3 py-2 border text-right">
                <input
                  type="number"
                  step="0.01"
                  value={row.fulfillment_usd}
                  onChange={(e) => update(i, 'fulfillment_usd', e.target.value)}
                  className="w-24 text-right border rounded px-1 py-0.5 text-sm"
                  title={row._fulfillment_rate_source || 'Fulfillment fee (USD)'}
                />
              </td>
              <td className="px-3 py-2 border text-right bg-blue-50 font-semibold">
                <span>{row.total_cost_usd.toFixed(2)}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-semibold">
            <td colSpan={6} className="px-3 py-2 border text-right">Totals</td>
            <td className="px-3 py-2 border text-right">{totals.cog_usd.toFixed(2)}</td>
            <td className="px-3 py-2 border text-right">{totals.shipping_usd.toFixed(2)}</td>
            <td className="px-3 py-2 border text-right">{totals.fulfillment_usd.toFixed(2)}</td>
            <td className="px-3 py-2 border text-right bg-blue-50">{totals.total_cost_usd.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
