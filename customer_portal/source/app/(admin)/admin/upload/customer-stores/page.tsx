import { FileUploader } from '@/components/admin/FileUploader'
import { customerStoresColumnMap } from '@/lib/admin/column-maps/customer-stores'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Customer Stores" apiPath="/api/admin/upload/customer-stores" columnMap={customerStoresColumnMap} /></div>
}
