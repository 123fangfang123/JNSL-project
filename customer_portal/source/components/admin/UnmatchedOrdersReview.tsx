'use client'
import { useState } from 'react'

export interface UnmatchedRow {
  transaction_id: string
  tracking_no: string
  dest_tracking: string
}

interface RowState {
  correctedId: string
  skip: boolean
}

interface Props {
  rows: UnmatchedRow[]
  onConfirm: (corrections: Record<string, string>, skipped: Set<string>) => void
  onCancel: () => void
}

export function UnmatchedOrdersReview({ rows, onConfirm, onCancel }: Props) {
  const [states, setStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((r) => [r.transaction_id, { correctedId: '', skip: false }]))
  )

  function setCorrected(tid: string, val: string) {
    setStates((prev) => ({ ...prev, [tid]: { ...prev[tid], correctedId: val } }))
  }

  function setSkip(tid: string, val: boolean) {
    setStates((prev) => ({ ...prev, [tid]: { ...prev[tid], skip: val, correctedId: val ? '' : prev[tid].correctedId } }))
  }

  const allSkipped = rows.every((r) => states[r.transaction_id].skip)

  function toggleSkipAll(val: boolean) {
    setStates((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([tid, s]) => [tid, { correctedId: val ? '' : s.correctedId, skip: val }])
      )
    )
  }

  function handleConfirm() {
    const corrections: Record<string, string> = {}
    const skipped = new Set<string>()
    for (const [tid, state] of Object.entries(states)) {
      if (state.skip) {
        skipped.add(tid)
      } else if (state.correctedId.trim()) {
        corrections[tid] = state.correctedId.trim()
      }
    }
    onConfirm(corrections, skipped)
  }

  const allResolved = rows.every((r) => {
    const s = states[r.transaction_id]
    return s.skip || s.correctedId.trim() !== ''
  })

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="font-semibold text-amber-800 text-sm">
          {rows.length} row{rows.length > 1 ? 's' : ''} could not be matched to an existing order.
        </p>
        <p className="text-amber-700 text-xs mt-1">
          For each row, enter the correct Transaction ID or check Skip to exclude it from the upload.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-2 font-medium text-gray-600">ID from file</th>
              <th className="text-left p-2 font-medium text-gray-600">Tracking No</th>
              <th className="text-left p-2 font-medium text-gray-600">Dest Tracking</th>
              <th className="text-left p-2 font-medium text-gray-600">Correct Transaction ID</th>
              <th className="p-2 font-medium text-gray-600">
                <div className="flex items-center justify-center gap-1">
                  <span>Skip</span>
                  <input
                    type="checkbox"
                    checked={allSkipped}
                    onChange={(e) => toggleSkipAll(e.target.checked)}
                    title="Skip all"
                    className="w-4 h-4 accent-amber-500"
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const state = states[row.transaction_id]
              return (
                <tr key={row.transaction_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 font-mono text-gray-700">{row.transaction_id}</td>
                  <td className="p-2 text-gray-600">{row.tracking_no}</td>
                  <td className="p-2 text-gray-600">{row.dest_tracking || '—'}</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={state.correctedId}
                      onChange={(e) => setCorrected(row.transaction_id, e.target.value)}
                      disabled={state.skip}
                      placeholder="Enter transaction ID…"
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40 disabled:bg-gray-100"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={state.skip}
                      onChange={(e) => setSkip(row.transaction_id, e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={!allResolved}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue Upload
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
