import { getPortalContext } from '@/lib/supabase/portal-context'
import { TopupTable } from '@/components/TopupTable'
import type { TopupRecord } from '@/lib/types'

interface SearchParams { from?: string; to?: string }

export default async function TopupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { supabase, customerId, isAdmin } = await getPortalContext()

  if (isAdmin && !customerId) {
    return <div className="p-8 text-gray-500 text-sm">Select a customer above to view their top-up history.</div>
  }

  let query = supabase
    .from('amount_received')
    .select('date_received, amount_transferred, amount_received')
    .order('date_received', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (params.from) query = query.gte('date_received', params.from)
  if (params.to) query = query.lte('date_received', params.to)

  const { data: rows, error } = await query

  if (error) {
    return (
      <div className="p-8 text-red-600 bg-red-50 rounded m-6 border border-red-200">
        Failed to load top-up history: {error.message}
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: TopupRecord[] = (rows ?? []).map((row: any) => ({
    date_received: row.date_received,
    amount_transferred: row.amount_transferred,
    amount_received: row.amount_received,
    difference: row.amount_transferred != null && row.amount_received != null
      ? Math.round((row.amount_transferred - row.amount_received) * 100) / 100
      : null,
  } satisfies TopupRecord))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Top-up History</h1>
      <TopupTable initialRecords={records} currentParams={params} />
    </div>
  )
}
