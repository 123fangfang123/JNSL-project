import { getPortalContext } from '@/lib/supabase/portal-context'
import { PackagingTable } from '@/components/PackagingTable'
import type { PackagingItem } from '@/lib/types'

interface SearchParams { from?: string; to?: string; store?: string; q?: string }

export default async function PackagingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { supabase, customerId, isAdmin } = await getPortalContext()

  if (isAdmin && !customerId) {
    return <div className="p-8 text-gray-500 text-sm">Select a customer above to view their packaging records.</div>
  }

  let storeQuery = supabase.from('customer_store').select('store_name').order('store_name')
  if (customerId) storeQuery = storeQuery.eq('customer_id', customerId)
  const { data: storeRows } = await storeQuery
  const stores = (storeRows ?? []).map(r => r.store_name)

  let query = supabase
    .from('packaging_po')
    .select('po_date, packaging_name, qty, unit_price_cny, total_cost_cny, exchange_rate_used, billing_date, usd_amt, remarks, store_name')
    .order('po_date', { ascending: false })
    .limit(1000)

  if (customerId) query = query.eq('customer_id', customerId)
  if (params.from) query = query.gte('po_date', params.from)
  if (params.to) query = query.lte('po_date', params.to)
  if (params.store) query = query.eq('store_name', params.store)
  if (params.q) query = query.ilike('packaging_name', `%${params.q}%`)

  const { data: rows, error } = await query

  if (error) {
    return (
      <div className="p-8 text-red-600 bg-red-50 rounded m-6 border border-red-200">
        Failed to load packaging records: {error.message}
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: PackagingItem[] = (rows ?? []).map((row: any) => ({
    po_date: row.po_date,
    packaging_name: row.packaging_name,
    qty: row.qty,
    unit_price_cny: row.unit_price_cny,
    total_cost_cny: row.total_cost_cny,
    exchange_rate_used: row.exchange_rate_used,
    billing_date: row.billing_date,
    usd_amt: row.usd_amt,
    remarks: row.remarks,
    store_name: row.store_name,
  } satisfies PackagingItem))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Custom Packaging Procurement</h1>
      <PackagingTable initialItems={items} stores={stores} currentParams={params} />
    </div>
  )
}
