'use client'
import { useState } from 'react'

type ShipmentRow = Record<string, unknown>
interface MultiShipmentOrder { transaction_id: string; shipments: ShipmentRow[] }

interface Props {
  orders: MultiShipmentOrder[]
  onConfirm: (selections: Record<string, string>) => void
  onCancel: () => void
}

export function ShipmentConflict({ orders, onConfirm, onCancel }: Props) {
  // Use _uid assigned by server (format: "tid:idx"), fallback to tracking_no or index
  const getKey = (s: ShipmentRow, idx: number) => String(s._uid || s.tracking_no || `__idx_${idx}`);

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const o of orders) init[o.transaction_id] = getKey(o.shipments[0], 0)
    return init
  })

  const allSelected = orders.every((o) => selections[o.transaction_id] !== undefined && selections[o.transaction_id] !== '')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-1 text-orange-600">Multiple Shipments Detected</h2>
        <p className="text-sm text-gray-600 mb-4">
          {orders.length} order{orders.length !== 1 ? 's have' : ' has'} more than one shipment row.
          Select the valid shipment for each. Others will be skipped.
        </p>

        <div className="overflow-y-auto flex-1 space-y-4 mb-4">
          {orders.map((order) => (
            <div key={order.transaction_id} className="border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Order: <span className="font-mono">{order.transaction_id}</span>
              </p>
              <div className="space-y-2">
                {order.shipments.map((s, idx) => {
                  const trackingNo = String(s.tracking_no ?? '')
                  const key = getKey(s, idx)
                  return (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name={order.transaction_id}
                        value={key}
                        checked={selections[order.transaction_id] === key}
                        onChange={() =>
                          setSelections((prev) => ({ ...prev, [order.transaction_id]: key }))
                        }
                      />
                      <span className="text-sm">
                        <span className="font-mono">{trackingNo || '(no tracking_no)'}</span>
                        {s.carrier != null && <span className="ml-2 text-gray-500">{String(s.carrier)}</span>}
                        {s.dispatch_date != null && (
                          <span className="ml-2 text-gray-400">{String(s.dispatch_date)}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selections)}
            disabled={!allSelected}
            className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Confirm selections
          </button>
        </div>
      </div>
    </div>
  )
}
