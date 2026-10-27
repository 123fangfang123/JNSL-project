'use client'
import { useState } from 'react'

type FreightRow = Record<string, unknown>

export interface FreightDuplicateGroup {
  tracking_no: string
  rows: FreightRow[]
}

interface Props {
  groups: FreightDuplicateGroup[]
  onConfirm: (selected: FreightRow[]) => void
  onCancel: () => void
}

function Field({ label, value }: { label: string; value: unknown }) {
  if (value == null || String(value).trim() === '' || String(value) === 'null') return null
  return (
    <span className="inline-flex gap-1">
      <span className="text-gray-400">{label}:</span>
      <span className="text-gray-800 font-medium">{String(value)}</span>
    </span>
  )
}

export function FreightDuplicateResolver({ groups, onConfirm, onCancel }: Props) {
  const [selections, setSelections] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map((g) => [g.tracking_no, 0]))
  )
  const [adjustedFreight, setAdjustedFreight] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((g) => [g.tracking_no, '']))
  )

  function handleConfirm() {
    const selected = groups.map((g) => {
      const row = { ...g.rows[selections[g.tracking_no]] }
      const adj = adjustedFreight[g.tracking_no].trim()
      if (adj !== '') {
        const parsed = parseFloat(adj)
        if (!isNaN(parsed)) row.freight = parsed
      }
      return row
    })
    onConfirm(selected)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 pb-3 shrink-0">
          <h2 className="text-lg font-semibold text-orange-600 mb-1">Duplicate Tracking Numbers in File</h2>
          <p className="text-sm text-gray-600">
            {groups.length} tracking number{groups.length !== 1 ? 's appear' : ' appears'} more than
            once in this file. Select which row to keep for each.
          </p>
        </div>

        {/* Scrollable groups */}
        <div className="flex-1 overflow-y-auto px-6 space-y-4 min-h-0 pb-2">
          {groups.map((group) => (
            <div key={group.tracking_no} className="border rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">
                Tracking No: <span className="font-mono text-gray-800">{group.tracking_no}</span>
                <span className="ml-2 text-gray-400">({group.rows.length} rows)</span>
              </p>
              <div className="space-y-2">
                {group.rows.map((row, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                    <input
                      type="radio"
                      name={group.tracking_no}
                      checked={selections[group.tracking_no] === i}
                      onChange={() =>
                        setSelections((prev) => ({ ...prev, [group.tracking_no]: i }))
                      }
                      className="mt-1"
                    />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <Field label="Billing date" value={row.billing_date} />
                      <Field label="Freight" value={row.freight != null ? `¥${row.freight}` : null} />
                      <Field label="Freight Fee" value={row.freight_fee != null ? `¥${row.freight_fee}` : null} />
                      <Field label="Registered" value={row.registered_fee != null ? `¥${row.registered_fee}` : null} />
                      <Field label="Other" value={row.other_fee != null ? `¥${row.other_fee}` : null} />
                      <Field label="Weight" value={row.weight_kg != null ? `${row.weight_kg} kg` : row.weight_g != null ? `${row.weight_g} g` : null} />
                      <Field label="Dest tracking" value={row.dest_tracking} />
                    </div>
                  </label>
                ))}
              </div>

              {/* Adjusted freight input — applies to whichever row is selected */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                <label className="text-xs text-gray-500 shrink-0">Adjusted freight (¥)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Leave blank to use selected row's value`}
                  value={adjustedFreight[group.tracking_no]}
                  onChange={(e) =>
                    setAdjustedFreight((prev) => ({ ...prev, [group.tracking_no]: e.target.value }))
                  }
                  className="border border-gray-300 rounded px-2 py-1 text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="p-6 pt-4 shrink-0 flex gap-3 justify-end border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700"
          >
            Confirm selections
          </button>
        </div>
      </div>
    </div>
  )
}
