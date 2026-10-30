import { getPortalContext } from '@/lib/supabase/portal-context'
import { OrdersTable } from '@/components/OrdersTable'

export default async function OrdersPage() {
  const { supabase, customerId } = await getPortalContext()

  let storeQuery = supabase.from('customer_store').select('store_name').order('store_name')
  if (customerId) storeQuery = storeQuery.eq('customer_id', customerId)
  const { data: storeRows } = await storeQuery
  const stores = (storeRows ?? []).map(r => r.store_name)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Order Tracking</h1>
      <OrdersTable stores={stores} customerId={customerId} />
    </div>
  )
}
