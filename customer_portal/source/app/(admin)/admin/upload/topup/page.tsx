import { FileUploader } from '@/components/admin/FileUploader'
import { topupColumnMap } from '@/lib/admin/column-maps/topup'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Top-up Records" apiPath="/api/admin/upload/topup" columnMap={topupColumnMap} /></div>
}
