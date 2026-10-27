'use client'

import { useState, useTransition, useMemo, Fragment } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { Order } from '@/lib/types'
import { OrderRow } from './OrderRow'

// Group orders by order_number + store_name (same order number may exist in different stores)
type OrderGroup = {
  order_number: number
  store_name: string
  orders: Order[]
  totalCount: number
}

type SortKey = keyof Order
type SortDir = 'asc' | 'desc'

const HEADER_SORT: Record<string, SortKey | null> = {
  'Order Date':    'order_date',
  'Order #':       'order_number',
  'Transaction #': 'transaction_id',
  'Store':         'store_name',
  'Country':       'country',
  'Tracking No.':  'tracking_no',
  'Carrier':       'carrier',
  'Dispatch Date': 'dispatch_date',
  'Status':        'order_status',
  'Reshipment':    'is_abnormal',
}

// Column widths for better alignment
const COLUMN_WIDTHS: Record<string, string> = {
  'Transaction #': 'w-36',
  'Order Date':    'w-28',
  'Order #':       'w-24',
  'Store':         'w-28',
  'Country':       'w-28',
  'Tracking No.':  'w-32',
  'Carrier':       'w-24',
  'Dispatch Date': 'w-28',
  'Status':        'w-24',
  'Reshipment':    'w-20',
}

const HEADERS = Object.keys(HEADER_SORT)

interface Props {
  initialOrders: Order[]
  stores: string[]
  currentParams: {
    from?: string
    to?: string
    store?: string
    q?: string
    status?: string
    product?: string
    isAbnormal?: string
    page?: string
    pageSize?: string
  }
}

export function OrdersTable({ initialOrders, stores, currentParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [from, setFrom] = useState(currentParams.from ?? '')
  const [to, setTo] = useState(currentParams.to ?? '')
  const [store, setStore] = useState(currentParams.store ?? '')
  const [status, setStatus] = useState(currentParams.status ?? '')
  const [q, setQ] = useState(currentParams.q ?? '')
  const [product, setProduct] = useState(currentParams.product ?? '')
  const [isAbnormal, setIsAbnormal] = useState(currentParams.isAbnormal ?? 'false')
  const [pageSize, setPageSize] = useState(parseInt(currentParams.pageSize ?? '100'))
  const [currentPage, setCurrentPage] = useState(parseInt(currentParams.page ?? '1'))

  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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

  function toggleGroup(orderNumber: number, storeName: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      const key = `${orderNumber}-${storeName}`
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const sorted = useMemo(() => {
    if (!sortKey) return initialOrders
    return [...initialOrders].sort((a, b) => {
      const av = (a[sortKey] as string | number) ?? ''
      const bv = (b[sortKey] as string | number) ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [initialOrders, sortKey, sortDir])

  // Filter by product name (requires fetching order_items)
  const filteredByProduct = useMemo(() => {
    if (!product) return sorted
    const lq = product.toLowerCase()
    // For now, we'll filter on client side - in production, this should be done server-side
    return sorted.filter(order => {
      // This is a simplified check - ideally we'd fetch items for each order
      // For better performance, consider adding product_name to the orders table or using a different approach
      return true // Placeholder - actual filtering happens in page.tsx
    })
  }, [sorted, product])

  // Pagination
  const totalPages = Math.ceil(filteredByProduct.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedOrders = filteredByProduct.slice(startIndex, endIndex)

  // Group orders by order_number + store_name
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, OrderGroup>()
    for (const order of paginatedOrders) {
      const groupKey = `${order.order_number}-${order.store_name}`
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          order_number: order.order_number,
          store_name: order.store_name,
          orders: [],
          totalCount: 0,
        })
      }
      const group = groups.get(groupKey)!
      group.orders.push(order)
      group.totalCount++
    }
    return Array.from(groups.values())
  }, [paginatedOrders])

  function applyFilters() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (store) params.set('store', store)
    if (status) params.set('status', status)
    if (q) params.set('q', q)
    if (product) params.set('product', product)
    if (isAbnormal) params.set('isAbnormal', isAbnormal)
    params.set('pageSize', String(pageSize))
    setCurrentPage(1) // Reset to first page
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function exportOrders() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (store) params.set('store', store)
    if (status) params.set('status', status)
    if (q) params.set('q', q)
    if (product) params.set('product', product)
    if (isAbnormal) params.set('isAbnormal', isAbnormal)
    window.open(`/api/export?${params.toString()}`, '_blank')
  }

  function exportOrderItems() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (store) params.set('store', store)
    if (status) params.set('status', status)
    if (q) params.set('q', q)
    if (product) params.set('product', product)
    if (isAbnormal) params.set('isAbnormal', isAbnormal)
    window.open(`/api/export-items?${params.toString()}`, '_blank')
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const shippedCount = initialOrders.filter(o => o.order_status === 'shipped').length
  const processedCount = initialOrders.filter(o => o.order_status === 'processed').length
  const cancelledCount = initialOrders.filter(o => o.order_status === 'cancelled').length
  const receivedCount = initialOrders.filter(o => o.order_status === 'received').length
  const abnormalCount = initialOrders.filter(o => o.is_abnormal).length
  const displayedCount = filteredByProduct.length

  return (
    <div>
      {/* Summary cards - Row 1 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Orders</p>
          <p className="text-xl font-bold mt-1 text-gray-900">{initialOrders.length.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Shipped</p>
          <p className="text-xl font-bold mt-1 text-green-600">{shippedCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Processed</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{processedCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Summary cards - Row 2 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Cancelled</p>
          <p className="text-xl font-bold mt-1 text-red-600">{cancelledCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Received</p>
          <p className="text-xl font-bold mt-1 text-blue-600">{receivedCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Reshipment</p>
          <p className="text-xl font-bold mt-1 text-red-600">{abnormalCount.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end bg-white p-4 rounded-lg border">
        <div>
          <p className="text-xs text-gray-500 mb-1">From</p>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">To</p>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Store</p>
          <select
            value={store}
            onChange={e => setStore(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Stores</option>
            {stores.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Order Status</p>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">All Status</option>
            <option value="shipped">Shipped</option>
            <option value="processed">Processed</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Search</p>
          <input
            type="text"
            placeholder="Order # or tracking…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            className="border rounded px-2 py-1.5 text-sm text-gray-700 w-44"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Product Name</p>
          <input
            type="text"
            placeholder="Search by product..."
            value={product}
            onChange={e => setProduct(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            className="border rounded px-2 py-1.5 text-sm text-gray-700 w-44"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Reshipment</p>
          <select
            value={isAbnormal}
            onChange={e => setIsAbnormal(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="false">Normal</option>
            <option value="true">Reshipment</option>
            <option value="all">All</option>
          </select>
        </div>
        <button
          onClick={applyFilters}
          disabled={isPending}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Loading…' : 'Apply'}
        </button>
        <button
          onClick={exportOrders}
          className="border px-4 py-1.5 rounded text-sm hover:bg-gray-50 ml-auto transition-colors"
        >
          ⬇ Orders Excel
        </button>
        <button
          onClick={exportOrderItems}
          className="border px-4 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors"
        >
          ⬇ Order Items Excel
        </button>
      </div>

      {/* Results count and pagination controls */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">
          Showing {paginatedOrders.length} of {displayedCount} orders (Page {currentPage} of {totalPages})
        </p>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Per page:</label>
          <select
            value={pageSize}
            onChange={e => {
              const newSize = parseInt(e.target.value)
              setPageSize(newSize)
              setCurrentPage(1)
            }}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border">
          No orders found for the selected period.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-8 p-3" />
                {HEADERS.map(h => {
                  const key = HEADER_SORT[h]
                  const widthClass = COLUMN_WIDTHS[h] || ''
                  const isActive = sortKey === key
                  return (
                    <th
                      key={h}
                      onClick={() => handleSort(h)}
                      className={`p-3 text-left text-xs font-medium whitespace-nowrap select-none ${widthClass} ${
                        key
                          ? 'cursor-pointer hover:text-gray-800 hover:bg-gray-100'
                          : 'cursor-default'
                      } ${isActive ? 'text-blue-600' : 'text-gray-500'}`}
                    >
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
              {groupedOrders.map(group => {
                const groupKey = `${group.order_number}-${group.store_name}`
                const isExpanded = expandedGroups.has(groupKey)
                const hasMultiple = group.orders.length > 1
                
                if (!hasMultiple) {
                  // Single transaction for this order number - render normally
                  return <OrderRow key={`order-${groupKey}`} order={group.orders[0]} />
                }
                
                // Multiple transactions for same order number - render grouped
                return (
                  <Fragment key={`group-${groupKey}`}>
                    {/* Group header row */}
                    <tr
                      onClick={() => toggleGroup(group.order_number, group.store_name)}
                      className={`border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                        isExpanded ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <td className="p-3 text-gray-400 text-xs select-none">
                        {isExpanded ? '▼' : '▶'}
                      </td>
                      <td className="p-3 whitespace-nowrap text-sm">
                        {group.orders[0].order_date ? group.orders[0].order_date.slice(0, 10) : '—'}
                      </td>
                      <td className="p-3 text-sm">
                        <span className="font-semibold text-indigo-700">{group.order_number}</span>
                      </td>
                      <td className="p-3 text-sm">
                        <span className="text-xs text-gray-500">{group.totalCount} transactions</span>
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-600">
                        {group.orders[0].store_name}
                      </td>
                      <td className="p-3 text-sm">{group.orders[0].country ?? '—'}</td>
                      <td className="p-3 font-mono text-xs">{group.orders[0].tracking_no ?? '—'}</td>
                      <td className="p-3 text-sm">{group.orders[0].carrier ?? '—'}</td>
                      <td className="p-3 text-sm whitespace-nowrap">{group.orders[0].dispatch_date ? group.orders[0].dispatch_date.slice(0, 10) : '—'}</td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                          Group
                        </span>
                      </td>
                      <td className="p-3 text-center text-sm">
                        {group.orders.some(o => o.is_abnormal) ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded child orders */}
                    {isExpanded && group.orders.map((order, idx) => (
                      <OrderRow key={`${order.transaction_id}-${idx}`} order={order} isChild />
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
