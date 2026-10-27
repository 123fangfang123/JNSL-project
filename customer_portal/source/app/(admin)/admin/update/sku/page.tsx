import { FileUploader } from '@/components/admin/FileUploader'
import { skuColumnMap } from '@/lib/admin/column-maps/sku'
export default function Page() {
  return <div className="p-6"><FileUploader title="Update SKU" apiPath="/api/admin/update/sku" columnMap={skuColumnMap} /></div>
}
