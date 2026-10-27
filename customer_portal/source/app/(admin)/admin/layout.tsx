// app/(admin)/layout.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const NAV = [
  {
    section: 'Upload',
    items: [
      { href: '/admin/upload/orders', label: 'Orders' },
      { href: '/admin/upload/shipments', label: 'Shipments' },
      { href: '/admin/upload/freight', label: 'Freight Bills' },
      { href: '/admin/upload/exchange-rates', label: 'Exchange Rates' },
      { href: '/admin/upload/topup', label: 'Top-up Records' },
      { href: '/admin/upload/packaging', label: 'Packaging PO' },
      { href: '/admin/upload/customers', label: 'Customers' },
      { href: '/admin/upload/customer-stores', label: 'Customer Stores' },
    ],
  },
  {
    section: 'Update',
    items: [
      { href: '/admin/update/sku', label: 'SKU' },
      { href: '/admin/update/shipment-status', label: 'Shipment Status' },
      { href: '/admin/update/stock', label: 'Customer Stock' },
    ],
  },
  {
    section: 'Billing',
    items: [
      { href: '/admin/billing', label: 'Run Billing' },
    ],
  },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleRow?.role !== 'admin') redirect('/')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col shrink-0">
        <div className="px-4 py-5 border-b">
          <p className="font-semibold text-gray-900">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section}
              </p>
              {items.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-700">
            ← Customer Portal
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
    </div>
  )
}
