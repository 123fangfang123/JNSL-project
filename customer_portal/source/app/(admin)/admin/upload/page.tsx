import Link from 'next/link'
const UPLOADS = [
  { href: '/admin/upload/orders', label: 'Orders', desc: 'Regular fulfillment orders + line items' },
  { href: '/admin/upload/shipments', label: 'Shipments', desc: 'Tracking and dispatch records' },
  { href: '/admin/upload/freight', label: 'Freight Bills', desc: 'Freight cost records' },
  { href: '/admin/upload/exchange-rates', label: 'Exchange Rates', desc: 'CNY/USD daily rates' },
  { href: '/admin/upload/topup', label: 'Top-up Records', desc: 'Customer payment top-ups' },
  { href: '/admin/upload/packaging', label: 'Packaging PO', desc: 'Custom packaging purchase orders' },
  { href: '/admin/upload/customers', label: 'Customers', desc: 'Customer master data' },
  { href: '/admin/upload/customer-stores', label: 'Customer Stores', desc: 'Store-to-customer mapping' },
]
export default function UploadMenuPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Data</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {UPLOADS.map(({ href, label, desc }) => (
          <Link key={href} href={href} className="block p-4 bg-white border rounded-lg hover:border-blue-400 hover:shadow-sm transition">
            <p className="font-medium text-gray-900">{label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
