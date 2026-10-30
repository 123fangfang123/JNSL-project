'use client'

import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from 'react'
import type { Order } from '@/lib/types'
import { OrderRow } from './OrderRow'

type OrderGroup = {
  order_number: string
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

interface Stats {
  total: number
  shipped: number
  processed: number
  received: number
  cancelled: number
  returned: number
  abnormal: number
}

interface Props {
  stores: string[]
  customerId: string | null
}

export function OrdersTable({ stores, customerId }: Props) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [store, setStore] = useState('')
  const [status, setStatus] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [trackingNo, setTrackingNo] = useState('')
  const [product, setProduct] = useState('')
  const [isAbnormal, setIsAbnormal] = useState('false')
  const [pageSize, setPageSize] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)

  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const fromRef = useRef(from); fromRef.current = from
  const toRef = useRef(to); toRef.current = to
  const storeRef = useRef(store); storeRef.current = store
  const statusRef = useRef(status); statusRef.current = status
  const orderNumberRef = useRef(orderNumber); orderNumberRef.current = orderNumber
  const trackingNoRef = useRef(trackingNo); trackingNoRef.current = trackingNo
  const productRef = useRef(product); productRef.current = product
  const isAbnormalRef = useRef(isAbnormal); isAbnormalRef.current = isAbnormal

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats>({ total: 0, shipped: 0, processed: 0, received: 0, cancelled: 0, returned: 0, abnormal: 0 })
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('pageSize', String(pageSize))
      if (fromRef.current) params.set('from', fromRef.current)
      if (toRef.current) params.set('to', toRef.current)
      if (storeRef.current) params.set('store', storeRef.current)
      if (statusRef.current) params.set('status', statusRef.current)
      if (orderNumberRef.current) params.set('orderNumber', orderNumberRef.current)
      if (trackingNoRef.current) params.set('trackingNo', trackingNoRef.current)
      if (productRef.current) params.set('product', productRef.current)
      if (isAbnormalRef.current) params.set('isAbnormal', isAbnormalRef.current)

      const res = await fetch(`/api/orders?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          setOrders([])
          setTotal(0)
          setError(null)
        } else {
          setError(data.error ?? 'Failed to load orders')
        }
      } else {
        setOrders(data.orders ?? [])
        setTotal(data.total ?? 0)
        setStats(data.stats ?? { total: 0, shipped: 0, processed: 0, received: 0, cancelled: 0, returned: 0, abnormal: 0 })
      }
    } catch {
      setError('Network error loading orders')
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, customerId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setFrom('')
    setTo('')
    setStore('')
    setStatus('')
    setOrderNumber('')
    setTrackingNo('')
    setProduct('')
    setIsAbnormal('false')
    setCurrentPage(1)
  }, [customerId])

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

  function toggleGroup(orderNumber: string, storeName: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      const key = `${orderNumber}-${storeName}`
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const sorted = useMemo(() => {
    if (!sortKey) return orders
    return [...orders].sort((a, b) => {
      const av = (a[sortKey] as string | number) ?? ''
      const bv = (b[sortKey] as string | number) ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [orders, sortKey, sortDir])

  // Group orders by order_number + store_name
  const groupedOrders = useMemo(() => {
    const groups = new Map<string, OrderGroup>()
    for (const order of sorted) {
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
  }, [sorted])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function applyFilters() {
    setApplying(true)
    if (currentPage === 1) {
      await fetchData()
    } else {
      setCurrentPage(1)
    }
    setApplying(false)
  }

  function exportOrders() {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (store) params.set('store', store)
    if (status) params.set('status', status)
    if (orderNumber) params.set('orderNumber', orderNumber)
    if (trackingNo) params.set('trackingNo', trackingNo)
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
    if (orderNumber) params.set('orderNumber', orderNumber)
    if (trackingNo) params.set('trackingNo', trackingNo)
    if (product) params.set('product', product)
    if (isAbnormal) params.set('isAbnormal', isAbnormal)
    window.open(`/api/export-items?${params.toString()}`, '_blank')
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const displayedCount = total

  return (
    <div>
      {/* Summary cards - Row 1 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Orders</p>
          <p className="text-xl font-bold mt-1 text-gray-900">{stats.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Shipped</p>
          <p className="text-xl font-bold mt-1 text-green-600">{stats.shipped.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Processed</p>
          <p className="text-xl font-bold mt-1 text-amber-600">{stats.processed.toLocaleString()}</p>
        </div>
      </div>

      {/* Summary cards - Row 2 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Cancelled</p>
          <p className="text-xl font-bold mt-1 text-red-600">{stats.cancelled.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Received</p>
          <p className="text-xl font-bold mt-1 text-blue-600">{stats.received.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Returned</p>
          <p className="text-xl font-bold mt-1 text-purple-600">{stats.returned.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border p-4" style={{ backgroundColor: '#ffffff' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Reshipment</p>
          <p className="text-xl font-bold mt-1 text-red-600">{stats.abnormal.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-end bg-white p-4 rounded-lg border">
        <div>
          <p className="text-xs text-gray-500 mb-1">From</p>
          <input
            type="date"
            lang="en"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm text-gray-700"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">To</p>
          <input
            type="date"
            lang="en"
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
            <option value="returned">Returned</option>
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Order #</p>
          <input
            type="text"
            placeholder="Search order #..."
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            className="border rounded px-2 py-1.5 text-sm text-gray-700 w-36"
          />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Tracking #</p>
          <input
            type="text"
            placeholder="Search tracking #..."
            value={trackingNo}
            onChange={e => setTrackingNo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilters()}
            className="border rounded px-2 py-1.5 text-sm text-gray-700 w-40"
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
          disabled={applying}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {applying ? 'Loading…' : 'Apply'}
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
          {loading
            ? 'Loading orders...'
            : `Showing ${orders.length} of ${displayedCount} orders (Page ${currentPage} of ${totalPages})`}
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
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {error && (
        <div className="text-center py-16 text-red-500 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      )}
      {!error && sorted.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border">
          No orders found for the selected period.
        </div>
      ) : !error && (
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
                  return <OrderRow key={`order-${groupKey}`} order={group.orders[0]} />
                }

                return (
                  <Fragment key={`group-${groupKey}`}>
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
                      <td className="p-3 text-sm">
                        <span className="text-xs text-gray-500">{group.orders[0].store_name}</span>
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
