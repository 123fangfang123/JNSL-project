'use client'

import { useState } from 'react'
import type { Order, OrderItem } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

const STATUS_COLORS: Record<string, { background: string; color: string; border: string }> = {
  shipped:   { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' },
  processed: { background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' },
  received:  { background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' },
  cancelled: { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' },
}

function fmt(n: number | null | undefined) {
  return n != null ? n.toFixed(2) : '—'
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return s.slice(0, 10)
}

export function AbnormalOrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<OrderItem[] | null>(null)
  const [loadingItems, setLoadingItems] = useState(false)
  const [itemsError, setItemsError] = useState(false)

  async function toggle() {
    if (!expanded && items === null) {
      setLoadingItems(true)
      setItemsError(false)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('order_items')
        .select('item_id, sku, product_name, qty')
        .eq('transaction_id', order.transaction_id)
      if (error) {
        setItemsError(true)
      } else {
        setItems(data ?? [])
      }
      setLoadingItems(false)
    }
    setExpanded(e => !e)
  }

  const total =
    (order.cog_usd ?? 0) +
    (order.shipping_usd ?? 0) +
    (order.fulfillment_usd ?? 0)

  const statusStyle = STATUS_COLORS[order.order_status] ?? {
    background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db',
  }

  return (
    <>
      <tr
        onClick={toggle}
        className={`border-b cursor-pointer hover:bg-gray-50 transition-colors ${
          expanded ? 'bg-blue-50' : ''
        }`}
      >
        <td className="p-3 text-gray-400 text-xs select-none">
          {expanded ? '▼' : '▶'}
        </td>
        <td className="p-3 whitespace-nowrap text-sm">{fmtDate(order.order_date)}</td>
        <td className="p-3 text-sm">{order.order_number}</td>
        <td className="p-3 font-mono text-xs text-gray-600">{order.transaction_id}</td>
        <td className="p-3 text-sm">{order.store_name}</td>
        <td className="p-3 text-sm">{order.country ?? '—'}</td>
        <td className="p-3 font-mono text-xs">{order.tracking_no ?? '—'}</td>
        <td className="p-3 text-sm">{order.carrier ?? '—'}</td>
        <td className="p-3 text-sm whitespace-nowrap">{fmtDate(order.dispatch_date)}</td>
        <td className="p-3 text-sm whitespace-nowrap">
          {order.billing_date ? (
            order.billing_date.slice(0, 10)
          ) : (
            <span className="text-amber-600 font-medium text-xs">Bill Pending</span>
          )}
        </td>
        <td className="p-3 text-right text-sm">{fmt(order.cog_usd)}</td>
        <td className="p-3 text-right text-sm">{fmt(order.shipping_usd)}</td>
        <td className="p-3 text-right text-sm">{fmt(order.fulfillment_usd)}</td>
        <td className="p-3 text-right font-bold text-sm">{total.toFixed(2)}</td>
        <td className="p-3">
          <span
            style={{
              background: statusStyle.background,
              color: statusStyle.color,
              border: statusStyle.border,
            }}
            className="text-xs px-2 py-0.5 rounded-full font-medium"
          >
            {order.order_status}
          </span>
        </td>
        <td className="p-3 text-xs text-gray-600 capitalize">
          {order.abnormal_code?.replace(/_/g, ' ') ?? '—'}
        </td>
      </tr>

      {expanded && (
        <tr className="border-b bg-gray-50">
          <td colSpan={16} className="px-10 py-6">
            {loadingItems && (
              <p className="text-sm text-gray-400">Loading line items…</p>
            )}
            {itemsError && (
              <p className="text-sm text-red-500">Could not load line items.</p>
            )}
            {!loadingItems && !itemsError && items !== null && (
              <div className="space-y-6">
                {/* Line items - with light green background */}
                <div className="bg-green-50 p-5 rounded-lg border-2 border-green-300 shadow-sm" style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac' }}>
                  <p className="text-sm font-bold text-green-900 mb-3 uppercase tracking-wide flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    Line Items
                  </p>
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No line items found for this order.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="text-sm border-collapse w-full">
                        <thead>
                          <tr className="bg-green-100 border-b-2 border-green-300">
                            <th className="px-4 py-2 text-left font-bold text-green-900 rounded-tl w-1/3">Product Name</th>
                            <th className="px-4 py-2 text-center font-bold text-green-900 w-1/3">Qty</th>
                            <th className="px-4 py-2 text-left font-bold text-green-900 rounded-tr w-1/3">Item ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => (
                            <tr key={i} className="border-b border-green-200 hover:bg-green-100 transition-colors">
                              <td className="px-4 py-2 font-medium text-gray-800 w-1/3">{item.product_name ?? '—'}</td>
                              <td className="px-4 py-2 text-center font-semibold text-green-800 w-1/3">{item.qty}</td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-600 w-1/3">{item.item_id ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Shipment info - with light blue background */}
                {order.tracking_no && (
                  <div className="bg-blue-50 p-5 rounded-lg border-2 border-blue-300 shadow-sm" style={{ backgroundColor: '#eff6ff', borderColor: '#93c5fd' }}>
                    <p className="text-sm font-bold text-blue-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                      <span className="text-lg">🚚</span>
                      Shipment Info
                    </p>
                    <dl className="grid grid-cols-5 gap-x-8 gap-y-4 text-sm">
                      <div className="bg-white p-3 rounded border border-blue-200">
                        <dt className="font-bold text-blue-800 mb-1 text-xs uppercase">Carrier</dt>
                        <dd className="text-gray-800 font-medium">{order.carrier ?? '—'}</dd>
                      </div>
                      <div className="bg-white p-3 rounded border border-blue-200">
                        <dt className="font-bold text-blue-800 mb-1 text-xs uppercase">Tracking No.</dt>
                        <dd className="text-gray-800 font-mono font-semibold">{order.tracking_no}</dd>
                      </div>
                      <div className="bg-white p-3 rounded border border-blue-200">
                        <dt className="font-bold text-blue-800 mb-1 text-xs uppercase">Dest Tracking</dt>
                        <dd className="text-gray-800 font-mono">{order.dest_tracking ?? '—'}</dd>
                      </div>
                      <div className="bg-white p-3 rounded border border-blue-200">
                        <dt className="font-bold text-blue-800 mb-1 text-xs uppercase">Shipment Status</dt>
                        <dd className="text-gray-800 font-medium">{order.shipment_status ?? '—'}</dd>
                      </div>
                      <div className="bg-white p-3 rounded border border-blue-200">
                        <dt className="font-bold text-blue-800 mb-1 text-xs uppercase">Exchange Rate</dt>
                        <dd className="text-gray-800 font-mono">{order.ex_rate_used ?? '—'}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                {/* Abnormal details - with light orange background */}
                <div className="bg-orange-50 p-5 rounded-lg border-2 border-orange-300 shadow-sm" style={{ backgroundColor: '#fff7ed', borderColor: '#fdba74' }}>
                  <p className="text-sm font-bold text-orange-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    Abnormal Details
                  </p>
                  <dl className="grid grid-cols-3 gap-x-8 gap-y-4 text-sm">
                    <div className="bg-white p-3 rounded border border-orange-200">
                      <dt className="font-bold text-orange-800 mb-1 text-xs uppercase">Abnormal Code</dt>
                      <dd className="text-gray-800 capitalize font-medium">{order.abnormal_code?.replace(/_/g, ' ') ?? '—'}</dd>
                    </div>
                    {!order.tracking_no && (
                      <div className="bg-white p-3 rounded border border-orange-200">
                        <dt className="font-bold text-orange-800 mb-1 text-xs uppercase">Exchange Rate</dt>
                        <dd className="text-gray-800 font-mono">{order.ex_rate_used ?? '—'}</dd>
                      </div>
                    )}
                    <div className="col-span-2 bg-white p-3 rounded border border-orange-200">
                      <dt className="font-bold text-orange-800 mb-1 text-xs uppercase">Remarks</dt>
                      <dd className="text-gray-800">{order.remarks ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
