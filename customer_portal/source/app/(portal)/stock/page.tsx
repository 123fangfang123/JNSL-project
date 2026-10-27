import { getPortalContext } from '@/lib/supabase/portal-context'
import { StockTable } from '@/components/StockTable'
import type { StockItem } from '@/lib/types'

export default async function StockPage() {
  const { supabase, customerId, isAdmin } = await getPortalContext()

  if (isAdmin && !customerId) {
    return <div className="p-8 text-gray-500 text-sm">Select a customer above to view their stock.</div>
  }

  const { data: customer } = customerId
    ? await supabase.from('customers').select('default_ex_rate').eq('customer_id', customerId).single()
    : { data: null }

  const exRate = customer?.default_ex_rate ?? 6.6

  let stockQuery = supabase.from('customer_stock').select('sku, qty, snapshot_at').order('sku')
  if (customerId) stockQuery = stockQuery.eq('customer_id', customerId)
  const { data: stockRows, error } = await stockQuery

  if (error) {
    return (
      <div className="p-8 text-red-600 bg-red-50 rounded m-6 border border-red-200">
        Failed to load stock: {error.message}
      </div>
    )
  }

  const skuIds = (stockRows ?? []).map(r => r.sku)
  const { data: skuRows } = skuIds.length > 0
    ? await supabase.from('sku').select('sku, sku_name, cny_price').in('sku', skuIds)
    : { data: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skuMap = new Map((skuRows ?? []).map((s: any) => [s.sku, s]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: StockItem[] = (stockRows ?? []).map((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skuData = skuMap.get(row.sku) as any
    const unitPriceUsd = skuData?.cny_price != null
      ? Math.round((skuData.cny_price / exRate) * 100) / 100
      : null
    const stockValueUsd = unitPriceUsd != null
      ? Math.round(row.qty * unitPriceUsd * 100) / 100
      : null
    return {
      sku: row.sku,
      sku_name: skuData?.sku_name ?? null,
      qty: row.qty,
      unit_price_usd: unitPriceUsd,
      stock_value_usd: stockValueUsd,
      snapshot_at: row.snapshot_at,
    } satisfies StockItem
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Stock on Hand</h1>
      <StockTable initialItems={items} />
    </div>
  )
}
