import { createClient } from '@/lib/supabase/server'
import { ModuleCard } from '@/components/ModuleCard'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Check role — admins get a landing page instead of the dashboard
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user!.id)
    .single()

  if (roleRow?.role === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Welcome back</h1>
          <p className="text-gray-500 text-center mb-8">Where would you like to go?</p>
          <div className="grid grid-cols-2 gap-4">
            <a
              href="/admin/upload/orders"
              className="block p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition text-center"
            >
              <div className="text-3xl mb-3">⚙️</div>
              <p className="font-semibold text-gray-900">Admin Panel</p>
              <p className="text-sm text-gray-500 mt-1">Upload data, manage billing</p>
            </a>
            <a
              href="/orders"
              className="block p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition text-center"
            >
              <div className="text-3xl mb-3">📦</div>
              <p className="font-semibold text-gray-900">Customer Portal</p>
              <p className="text-sm text-gray-500 mt-1">View order tracking</p>
            </a>
          </div>
        </div>
      </div>
    )
  }

  const [
    stockRes,
    topupTotalRes,
  ] = await Promise.all([
    // Stock total qty (for module card stat)
    supabase
      .from('customer_stock')
      .select('qty'),
    // Top-up total for module card stat
    supabase
      .from('amount_received')
      .select('amount_received'),
  ])

  // Module card stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalStock = (stockRes.data ?? []).reduce((s: number, r: any) => s + (r.qty ?? 0), 0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalTopupCard = (topupTotalRes.data ?? []).reduce((s: number, r: any) => s + (r.amount_received ?? 0), 0)

  function fmt(n: number) {
    return `$${n.toFixed(2)}`
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
        <ModuleCard
          href="/orders"
          icon="📦"
          title="Order Tracking"
          description="View fulfillment orders, shipment details"
        />
        <ModuleCard
          href="/packaging"
          icon="📫"
          title="Custom Packaging Procurement"
          description="Custom packaging purchase orders and costs"
          soon
        />
        <ModuleCard
          href="/stock"
          icon="🏭"
          title="Stock on Hand"
          description="Current inventory snapshot"
          stat={`${totalStock.toLocaleString()} units`}
          soon
        />
        <ModuleCard
          href="/topup"
          icon="💰"
          title="Top-up History"
          description="Payment top-up records"
          stat={`${fmt(totalTopupCard)} received`}
          soon
        />
      </div>
    </div>
  )
}
