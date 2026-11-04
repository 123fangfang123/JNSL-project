'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ReturnedOrder {
  transaction_id: string
  order_number: string
  dispatch_date: string
  order_status: string
  store_name: string
  tracking_no: string | null
  dest_tracking: string | null
  shipment_status: string
}

export default function CheckReturnedOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<ReturnedOrder[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [page])

  async function fetchOrders(showLoading = true) {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/check-returned-orders?page=${page}&pageSize=${pageSize}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || '查询失败')
      } else {
        setOrders(json.data || [])
        setTotal(json.total || 0)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.transaction_id)))
    }
  }

  async function handleReturn() {
    if (selectedIds.size === 0) {
      setError('请至少选择一个订单')
      return
    }

    if (!confirm(`确定要将选中的 ${selectedIds.size} 个订单标记为退货吗？`)) {
      return
    }

    setReturning(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/return-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: Array.from(selectedIds) }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || '操作失败')
      } else {
        setSuccess(`成功标记 ${json.returned} 个订单为退货`)
        setSelectedIds(new Set())
        await fetchOrders(false)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setReturning(false)
    }
  }

  function handleBack() {
    router.push('/admin/upload/orders')
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/check-returned-orders/export')
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.error || '导出失败')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `returned_orders_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(String(err))
    } finally {
      setExporting(false)
    }
  }

  function goToPage(p: number) {
    if (p < 1 || p > Math.ceil(total / pageSize)) return
    setPage(p)
    setSelectedIds(new Set())
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  if (orders.length === 0 && !error && total === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">检测是否已退货的订单</h1>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500">没有符合条件的订单</p>
          <button
            onClick={handleBack}
            className="mt-4 px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            返回
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">检测是否已退货的订单</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={handleReturn}
          disabled={returning || selectedIds.size === 0}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {returning ? '处理中...' : `退货 (${selectedIds.size})`}
        </button>
        <button
          onClick={handleBack}
          className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          取消
        </button>
        <span className="text-sm text-gray-600">
          共 {total} 条订单，已选 {selectedIds.size} 条
        </span>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? '导出中...' : '下载'}
        </button>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size === orders.length && orders.length > 0}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">交易编号</th>
              <th className="px-3 py-2 text-left">订单编号</th>
              <th className="px-3 py-2 text-left">店铺</th>
              <th className="px-3 py-2 text-left">订单状态</th>
              <th className="px-3 py-2 text-left">发货时间</th>
              <th className="px-3 py-2 text-left">运单号</th>
              <th className="px-3 py-2 text-left">目的追踪号</th>
              <th className="px-3 py-2 text-left">物流状态</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, i) => (
              <tr key={order.transaction_id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.transaction_id)}
                    onChange={() => toggleSelect(order.transaction_id)}
                    className="cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2">{(page - 1) * pageSize + i + 1}</td>
                <td className="px-3 py-2 font-mono text-xs">{order.transaction_id}</td>
                <td className="px-3 py-2">{order.order_number}</td>
                <td className="px-3 py-2">{order.store_name}</td>
                <td className="px-3 py-2">{order.order_status}</td>
                <td className="px-3 py-2">{order.dispatch_date}</td>
                <td className="px-3 py-2">{order.tracking_no || '-'}</td>
                <td className="px-3 py-2">{order.dest_tracking || '-'}</td>
                <td className="px-3 py-2 text-green-600">{order.shipment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          第 {page} 页 / 共 {totalPages} 页
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => goToPage(1)}
            disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            首页
          </button>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
          <button
            onClick={() => goToPage(totalPages)}
            disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            末页
          </button>
        </div>
      </div>
    </div>
  )
}
