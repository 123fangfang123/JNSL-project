import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { SignOutButton } from '@/components/SignOutButton'
import { CustomerPickerBar } from '@/components/admin/CustomerPickerBar'

const NAV = [
  { href: '/', label: 'Dashboard', icon: '🏠', soon: false, hidden: false },
  { href: '/orders', label: 'Order Tracking', icon: '📦', soon: false, hidden: false },
  { href: '/packaging', label: 'Custom Packaging Procurement', icon: '📫', soon: false, hidden: true },
  { href: '/stock', label: 'Stock on Hand', icon: '🏭', soon: false, hidden: true },
  { href: '/topup', label: 'Top-up History', icon: '💰', soon: false, hidden: true },
]

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  const isAdmin = roleRow?.role === 'admin'

  // For regular users: show their name in the footer
  const { data: customerUser } = await supabase
    .from('customer_user')
    .select('customer_id')
    .eq('auth_user_id', user.id)
    .single()

  let customerName: string | null = null
  if (customerUser) {
    const { data: customerRow } = await supabase
      .from('customers')
      .select('name')
      .eq('customer_id', customerUser.customer_id)
      .single()
    customerName = customerRow?.name ?? null
  }

  // For admins: load customer list and currently selected customer from cookie
  let allCustomers: Array<{ customer_id: string; name: string }> = []
  let adminViewingAs: string | null = null
  if (isAdmin) {
    const serviceClient = createServiceClient()
    const { data: customerList } = await serviceClient
      .from('customers')
      .select('customer_id, name')
      .order('name')
    allCustomers = customerList ?? []
    const cookieStore = await cookies()
    adminViewingAs = cookieStore.get('admin_viewing_as')?.value ?? null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col shrink-0">
        <div className="px-4 py-5 border-b">
          <p className="font-semibold text-gray-900">Billing Portal</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.filter(item => !item.hidden).map(({ href, label, icon, soon }) =>
            soon ? (
              <div
                key={href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-300 cursor-default select-none"
              >
                <span>{icon}</span>
                <span>{label}</span>
                <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
            ) : (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-700 hover:bg-gray-100"
              >
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            )
          )}
        </nav>
        <div className="p-4 border-t">
          <p className="text-sm font-medium text-gray-800 truncate">
            {customerName ?? user.email}
          </p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {isAdmin && (
          <CustomerPickerBar customers={allCustomers} currentCustomerId={adminViewingAs} />
        )}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
