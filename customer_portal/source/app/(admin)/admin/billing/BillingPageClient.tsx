'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BillingTable, BillingRow } from '@/components/admin/BillingTable'

interface UnbilledOrder {
  transaction_id: string
  store_name: string | null
  order_date: string | null
  dispatch_date: string | null
  order_status: string | null
  tracking_no: string | null
  billing_date: string | null
  cog_usd: number | null
  shipping_usd: number | null
  fulfillment_usd: number | null
  total_cost_usd: number | null
}

interface Props {
  unbilledOrders: UnbilledOrder[]
  stores: string[]
}

type Step = 'select' | 'preview' | 'confirm' | 'done' | 'error'

const ORDER_STATUSES = ['shipped', 'processed', 'received', 'cancelled', 'returned']

export function BillingPageClient({ unbilledOrders, stores }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>('select')
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [billingRows, setBillingRows] = useState<BillingRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ updated: number } | null>(null)
  
  // Filter state
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '')
  const [toDate, setToDate] = useState(searchParams.get('to') || '')
  const [filterStore, setFilterStore] = useState(searchParams.get('store') || '')
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '')
  const [showBilled, setShowBilled] = useState(searchParams.get('billed') === 'true')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

  // Apply filters via URL
  function applyFilters() {
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    if (filterStore) params.set('store', filterStore)
    if (filterStatus) params.set('status', filterStatus)
    if (showBilled) params.set('billed', 'true')
    
    router.push(`/admin/billing?${params.toString()}`)
    setCurrentPage(1) // Reset to first page when filtering
  }

  function clearFilters() {
    setFromDate('')
    setToDate('')
    setFilterStore('')
    setFilterStatus('')
    setShowBilled(false)
    router.push('/admin/billing')
    setCurrentPage(1)
  }

  function toggleOrder(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const currentPageIds = paginatedOrders.map((o) => o.transaction_id)
    const allSelected = currentPageIds.every((id) => selectedIds.has(id))
    
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        // Deselect all on current page
        currentPageIds.forEach((id) => next.delete(id))
      } else {
        // Select all on current page
        currentPageIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  // Pagination helpers
  const totalPages = Math.ceil(unbilledOrders.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedOrders = unbilledOrders.slice(startIndex, endIndex)

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  async function handlePreview() {
    if (selectedIds.size === 0) { setError('Please select at least one order.'); return }
    setError(null)
    setStep('preview')

    // Don't require exchange rate anymore - admin will input billing date in preview
    const res = await fetch('/api/admin/billing/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        orderIds: Array.from(selectedIds), 
        billingDate: null // Will be set by admin in preview page
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to load preview')
      setStep('select')
      return
    }
    setBillingRows(json.rows)
  }

  async function handleConfirm(billingDate: string, exRateUsed: number) {
    setStep('confirm')
    const res = await fetch('/api/admin/billing/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingDate,
        exRateUsed,
        orders: billingRows.map((r) => ({
          transaction_id: r.transaction_id,
          cog_usd: r.cog_usd,
          shipping_usd: r.shipping_usd,
          fulfillment_usd: r.fulfillment_usd,
          total_cost_usd: r.total_cost_usd,
        })),
      }),
    })
    const json = await res.json()
    if (!res.ok || json.error) { setError(json.error); setStep('preview'); return }
    setResult(json)
    setStep('done')
  }

  if (step === 'done' && result) {
    return (
      <div className="p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md">
          <p className="font-semibold text-green-700 text-lg">Billing complete</p>
          <p className="text-green-600 mt-1">{result.updated} orders billed</p>
          <button
            onClick={() => { setStep('select'); setSelectedIds(new Set()); clearFilters() }}
            className="mt-4 text-sm text-green-700 underline"
          >
            Bill more orders
          </button>
        </div>
      </div>
    )
  }

  if (step === 'preview') {
    return (
      <BillingPreviewPage
        rows={billingRows}
        onBack={() => setStep('select')}
        onConfirm={handleConfirm}
      />
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing</h1>

      {unbilledOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No orders found.</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white border rounded-lg p-4 mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Store</label>
                <select
                  value={filterStore}
                  onChange={(e) => setFilterStore(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">All Stores</option>
                  {stores.map((store) => (
                    <option key={store} value={store}>{store}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Order Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">All Statuses</option>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Billed Status</label>
                <select
                  value={showBilled ? 'true' : 'false'}
                  onChange={(e) => setShowBilled(e.target.value === 'true')}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="false">Unbilled Only</option>
                  <option value="true">Show All (Including Billed)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={applyFilters}
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  Apply
                </button>
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50 whitespace-nowrap"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}

          {/* Action bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
                <span className="text-sm text-gray-600">per page</span>
              </div>
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(endIndex, unbilledOrders.length)} of {unbilledOrders.length} orders
              </div>
            </div>
            <button
              onClick={handlePreview}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Preview billing ({selectedIds.size} selected)
            </button>
          </div>

          {/* Orders table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 border-b text-center w-8">
                    <input
                      type="checkbox"
                      checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.has(o.transaction_id))}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2 border-b text-left">Transaction ID</th>
                  <th className="px-3 py-2 border-b text-left">Store</th>
                  <th className="px-3 py-2 border-b text-left">Order Date</th>
                  <th className="px-3 py-2 border-b text-left">Dispatch Date</th>
                  <th className="px-3 py-2 border-b text-left">Order Status</th>
                  <th className="px-3 py-2 border-b text-left">Tracking No</th>
                  <th className="px-3 py-2 border-b text-right">COG (USD)</th>
                  <th className="px-3 py-2 border-b text-right">Shipping (USD)</th>
                  <th className="px-3 py-2 border-b text-right">Fulfillment (USD)</th>
                  <th className="px-3 py-2 border-b text-right">Total Cost (USD)</th>
                  <th className="px-3 py-2 border-b text-left">Billing Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => (
                  <tr key={order.transaction_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleOrder(order.transaction_id)}>
                    <td className="px-3 py-2 border-b text-center">
                      <input type="checkbox" checked={selectedIds.has(order.transaction_id)} onChange={() => toggleOrder(order.transaction_id)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="px-3 py-2 border-b font-mono text-xs">{order.transaction_id}</td>
                    <td className="px-3 py-2 border-b">{order.store_name ?? '—'}</td>
                    <td className="px-3 py-2 border-b">{order.order_date ?? '—'}</td>
                    <td className="px-3 py-2 border-b">{order.dispatch_date ?? '—'}</td>
                    <td className="px-3 py-2 border-b">{order.order_status ?? '—'}</td>
                    <td className="px-3 py-2 border-b font-mono text-xs">{order.tracking_no ?? '—'}</td>
                    <td className="px-3 py-2 border-b text-right">{order.cog_usd != null ? `$${order.cog_usd.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 border-b text-right">{order.shipping_usd != null ? `$${order.shipping_usd.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 border-b text-right">{order.fulfillment_usd != null ? `$${order.fulfillment_usd.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 border-b text-right font-semibold">{order.total_cost_usd != null ? `$${order.total_cost_usd.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 border-b">{order.billing_date ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Billing Preview Page Component
function BillingPreviewPage({ 
  rows, 
  onBack, 
  onConfirm 
}: { 
  rows: BillingRow[]
  onBack: () => void
  onConfirm: (billingDate: string, exRateUsed: number) => Promise<void>
}) {
  const [billingDate, setBillingDate] = useState('')
  const [exRateUsed, setExRateUsed] = useState<number>(7.0)
  const [isConfirming, setIsConfirming] = useState(false)

  const totals = rows.reduce(
    (acc, r) => ({
      cog_usd: acc.cog_usd + r.cog_usd,
      shipping_usd: acc.shipping_usd + r.shipping_usd,
      fulfillment_usd: acc.fulfillment_usd + r.fulfillment_usd,
      total_cost_usd: acc.total_cost_usd + r.total_cost_usd,
    }),
    { cog_usd: 0, shipping_usd: 0, fulfillment_usd: 0, total_cost_usd: 0 }
  )

  async function handleConfirmClick() {
    if (!billingDate) {
      alert('Please enter a billing date')
      return
    }
    setIsConfirming(true)
    await onConfirm(billingDate, exRateUsed)
    setIsConfirming(false)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Billing Preview</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} orders · Total cost: ${totals.total_cost_usd.toFixed(2)}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
            Back
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={isConfirming}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isConfirming ? 'Saving…' : `Confirm billing (${rows.length} orders)`}
          </button>
        </div>
      </div>

      {/* Billing date and exchange rate inputs */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Date *</label>
            <input
              type="date"
              value={billingDate}
              onChange={(e) => setBillingDate(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate *</label>
            <input
              type="number"
              step="0.0001"
              value={exRateUsed}
              onChange={(e) => setExRateUsed(parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">You can edit USD values before confirming.</p>
      <BillingTable rows={rows} onChange={() => {}} />
    </div>
  )
}
