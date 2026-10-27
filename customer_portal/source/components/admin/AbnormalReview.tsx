'use client'
import { useState } from 'react'

const ABNORMAL_CODE_OPTIONS = [
  { value: 'package_lost', label: 'Package Lost 丢包' },
  { value: 'customer_request', label: 'Customer Request 客户要求/修改信息' },
  { value: 'defective', label: 'Defective 故障/瑕疵' },
  { value: 'damaged', label: 'Damaged 破损' },
  { value: 'wrong_item', label: 'Wrong Item 发错/与实物不符' },
  { value: 'missing_item', label: 'Missing Item 漏发' },
  { value: 'change_shipping', label: 'Change Shipping 更换渠道/运单/大件分单' },
  { value: 'shopify_error', label: 'Shopify Error SKU混淆' },
  { value: 'amend_info', label: 'Amend Info 修改地址' },
]

export interface AbnormalRowData {
  transaction_id: string
  store_name?: unknown
  order_date?: unknown
  abnormal_code: string
  reason_raw: string
  reason_missing?: boolean
}

interface Props {
  rows: AbnormalRowData[]
  onConfirm: (updatedRows: AbnormalRowData[]) => void
  onCancel: () => void
}

export function AbnormalReview({ rows, onConfirm, onCancel }: Props) {
  const [codes, setCodes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const r of rows) init[r.transaction_id] = r.abnormal_code
    return init
  })

  const allSet = rows.every((r) => codes[r.transaction_id])
  const missingCount = rows.filter((r) => r.reason_missing).length

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col p-6">
        <h2 className="text-lg font-semibold mb-1 text-orange-600">Review Abnormal Orders</h2>
        <p className="text-sm text-gray-500 mb-4">
          {rows.length} abnormal order{rows.length !== 1 ? 's' : ''} detected. Verify the code for each before uploading.
        </p>
        {missingCount > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">⚠ {missingCount}</span> 个异常订单缺少重发原因，已自动默认为 <span className="font-semibold">Customer Request 客户要求/修改信息</span>
            </p>
          </div>
        )}
        <div className="overflow-y-auto flex-1 mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 border font-medium text-gray-600">Transaction ID</th>
                <th className="px-3 py-2 border font-medium text-gray-600">Store</th>
                <th className="px-3 py-2 border font-medium text-gray-600">Raw Reason</th>
                <th className="px-3 py-2 border font-medium text-gray-600">Abnormal Code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.transaction_id} className={!codes[row.transaction_id] ? 'bg-red-50' : row.reason_missing ? 'bg-yellow-50' : ''}>
                  <td className="px-3 py-2 border font-mono text-xs">{row.transaction_id}</td>
                  <td className="px-3 py-2 border">{String(row.store_name ?? '—')}</td>
                  <td className="px-3 py-2 border text-gray-500">{row.reason_raw || '—'}</td>
                  <td className="px-3 py-2 border">
                    <select
                      value={codes[row.transaction_id] ?? ''}
                      onChange={(e) =>
                        setCodes((prev) => ({ ...prev, [row.transaction_id]: e.target.value }))
                      }
                      className="w-full border rounded px-2 py-1 text-sm"
                    >
                      <option value="">— select —</option>
                      {ABNORMAL_CODE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!allSet && (
          <p className="text-sm text-red-600 mb-3">Please select an abnormal code for all highlighted rows.</p>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() =>
              onConfirm(rows.map((r) => ({ ...r, abnormal_code: codes[r.transaction_id] ?? '' })))
            }
            disabled={!allSet}
            className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Confirm {rows.length} abnormal orders
          </button>
        </div>
      </div>
    </div>
  )
}