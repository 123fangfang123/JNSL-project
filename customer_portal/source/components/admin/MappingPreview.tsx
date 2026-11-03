'use client'

interface MappedColumn { source: string; db: string }

interface Props {
  mapped: MappedColumn[]
  unmapped: string[]
  onConfirm: () => void
  onCancel: () => void
  inline?: boolean
}

export function MappingPreview({ mapped, unmapped, onConfirm, onCancel, inline = false }: Props) {
  const card = (
      <div className={inline
        ? 'bg-white rounded-xl border border-gray-200 p-6 flex flex-col'
        : 'bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col'}>
        <h2 className="text-lg font-semibold mb-1">Column Mapping Preview</h2>
        <p className="text-sm text-gray-500 mb-4">
          Verify that the source columns (from your Excel file) map to the correct database fields.
        </p>

        <div className={inline ? 'overflow-y-auto max-h-[50vh] mb-4' : 'overflow-y-auto flex-1 mb-4'}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Excel Column</th>
                <th className="text-left py-2 font-medium text-gray-600">Database Field</th>
              </tr>
            </thead>
            <tbody>
              {mapped.map(({ source, db }) => (
                <tr key={source} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 text-gray-800">{source}</td>
                  <td className="py-1.5 font-mono text-xs text-gray-600">{db}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {unmapped.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs font-semibold text-yellow-700 mb-1">
                Unmapped columns (will be ignored):
              </p>
              <p className="text-xs text-yellow-600">{unmapped.join(', ')}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Looks good — proceed
          </button>
        </div>
      </div>
  )

  if (inline) return card

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      {card}
    </div>
  )
}
