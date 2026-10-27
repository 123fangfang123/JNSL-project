import { FileUploader } from '@/components/admin/FileUploader'
import { stockColumnMap } from '@/lib/admin/column-maps/stock'
export default function Page() {
  return <div className="p-6"><FileUploader title="Update Customer Stock" apiPath="/api/admin/update/stock" columnMap={stockColumnMap} /></div>
}
