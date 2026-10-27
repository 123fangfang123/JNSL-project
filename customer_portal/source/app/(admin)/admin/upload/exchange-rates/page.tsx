import { FileUploader } from '@/components/admin/FileUploader'
import { exchangeRatesColumnMap } from '@/lib/admin/column-maps/exchange-rates'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Exchange Rates" apiPath="/api/admin/upload/exchange-rates" columnMap={exchangeRatesColumnMap} /></div>
}
