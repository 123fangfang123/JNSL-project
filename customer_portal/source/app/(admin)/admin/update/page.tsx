import Link from 'next/link'
const UPDATES = [
  { href: '/admin/update/sku', label: 'SKU', desc: 'Update SKU names and CNY prices' },
  { href: '/admin/update/shipment-status', label: 'Shipment Status', desc: 'Update tracking shipment statuses' },
  { href: '/admin/update/stock', label: 'Customer Stock', desc: 'Update customer inventory quantities' },
]
export default function UpdateMenuPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Update Records</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {UPDATES.map(({ href, label, desc }) => (
          <Link key={href} href={href} className="block p-4 bg-white border rounded-lg hover:border-blue-400 hover:shadow-sm transition">
            <p className="font-medium text-gray-900">{label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
