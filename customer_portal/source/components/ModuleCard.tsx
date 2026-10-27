import Link from 'next/link'

interface ModuleCardProps {
  href: string
  icon: string
  title: string
  description: string
  stat?: string
  soon?: boolean
}

export function ModuleCard({ href, icon, title, description, stat, soon }: ModuleCardProps) {
  const card = (
    <div
      className={`bg-white rounded-xl border p-6 transition-shadow ${
        soon ? 'opacity-50 cursor-default' : 'hover:shadow-md cursor-pointer'
      }`}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1">
        {title}
        {soon && <span className="text-sm font-normal text-gray-400 ml-2">--coming soon</span>}
      </h3>
      <p className="text-sm text-gray-500">{description}</p>
      {stat && <p className="text-2xl font-bold text-gray-900 mt-4">{stat}</p>}
    </div>
  )
  if (soon) return card
  return <Link href={href}>{card}</Link>
}
