import { FileUploader } from '@/components/admin/FileUploader'
import { packagingColumnMap } from '@/lib/admin/column-maps/packaging'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Packaging PO" apiPath="/api/admin/upload/packaging" columnMap={packagingColumnMap} /></div>
}
