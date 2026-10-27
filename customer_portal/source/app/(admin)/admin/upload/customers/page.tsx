import { FileUploader } from '@/components/admin/FileUploader'
import { customersColumnMap } from '@/lib/admin/column-maps/customers'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Customers" apiPath="/api/admin/upload/customers" columnMap={customersColumnMap} /></div>
}
