'use client'
import { useRouter } from 'next/navigation'

interface Props {
  customers: Array<{ customer_id: string; name: string }>
  currentCustomerId: string | null
}

export function CustomerPickerBar({ customers, currentCustomerId }: Props) {
  const router = useRouter()

  function handleChange(customerId: string) {
    document.cookie = `admin_viewing_as=${customerId}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
    router.refresh()
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3 shrink-0">
      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Admin preview</span>
      <select
        value={currentCustomerId ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="text-sm border border-amber-300 rounded px-2 py-1 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
      >
        <option value="" disabled>Select a customer…</option>
        {customers.map((c) => (
          <option key={c.customer_id} value={c.customer_id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
