import { FileUploader } from '@/components/admin/FileUploader'
import { shipmentStatusColumnMap } from '@/lib/admin/column-maps/shipment-status'
export default function Page() {
  return <div className="p-6"><FileUploader title="Update Shipment Status" apiPath="/api/admin/update/shipment-status" columnMap={shipmentStatusColumnMap} /></div>
}
