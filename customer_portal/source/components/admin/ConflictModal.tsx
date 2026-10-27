'use client'

interface Props {
  duplicates: string[]
  onConfirm: () => void
  onCancel: () => void
  onSkip?: () => void
}

export function ConflictModal({ duplicates, onConfirm, onCancel, onSkip }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[85vh]">
        {/* Header — always visible */}
        <div className="p-6 pb-3 shrink-0">
          <h2 className="text-lg font-semibold mb-1 text-orange-600">Duplicate Records Found</h2>
          <p className="text-sm text-gray-600">
            {duplicates.length} record{duplicates.length !== 1 ? 's' : ''} already exist in the database.
          </p>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto mx-6 bg-gray-50 rounded border p-2 min-h-0">
          {duplicates.map((pk) => (
            <p key={pk} className="text-xs font-mono text-gray-700">{pk}</p>
          ))}
        </div>

        {/* Buttons — always visible */}
        <div className="p-6 pt-4 shrink-0 flex flex-wrap gap-3 justify-end border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm rounded border border-blue-400 text-blue-600 hover:bg-blue-50"
            >
              Skip duplicates
            </button>
          )}
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700"
          >
            Update {duplicates.length} record{duplicates.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
