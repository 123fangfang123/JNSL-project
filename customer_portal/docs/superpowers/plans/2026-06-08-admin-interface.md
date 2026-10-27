# Admin Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/admin` section inside the existing Next.js 15 customer portal for uploading data, updating records, and running billing calculations.

**Architecture:** Route group `(admin)` with its own layout and sidebar. Admin layout checks `user_roles.role = 'admin'` and redirects non-admins. All API routes under `app/api/admin/` use a service-role Supabase client that bypasses RLS. Excel parsing happens client-side with the `xlsx` library (already installed); only parsed JSON is sent to API routes.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (`@supabase/ssr`), `xlsx` v0.18.5, Tailwind CSS v4, shadcn/ui (Radix primitives already installed)

---

## File Map

**New files:**
- `lib/supabase/service.ts` — service-role Supabase client
- `lib/admin/apply-column-map.ts` — re-keys parsed Excel rows from Chinese → DB field names
- `lib/admin/column-maps/orders.ts` through `stock.ts` (11 files) — one config per upload/update type
- `app/(admin)/layout.tsx` — admin sidebar + auth guard
- `app/(admin)/page.tsx` — admin home (redirects to /admin/upload)
- `app/(admin)/upload/page.tsx` — upload menu
- `app/(admin)/upload/orders/page.tsx` through `customer-stores/page.tsx` (9 pages)
- `app/(admin)/update/page.tsx` — update menu
- `app/(admin)/update/sku/page.tsx`, `shipment-status/page.tsx`, `stock/page.tsx`
- `app/(admin)/billing/page.tsx` — billing workflow
- `app/api/admin/upload/orders/route.ts` through `customer-stores/route.ts` (9 routes)
- `app/api/admin/update/sku/route.ts`, `shipment-status/route.ts`, `stock/route.ts`
- `app/api/admin/billing/preview/route.ts`
- `app/api/admin/billing/confirm/route.ts`
- `components/admin/MappingPreview.tsx` — shows source → DB column mapping table before import
- `components/admin/ConflictModal.tsx` — duplicate PK resolution dialog
- `components/admin/ShipmentConflict.tsx` — multi-shipment resolution modal
- `components/admin/FileUploader.tsx` — reusable upload shell (wraps the above)
- `components/admin/BillingTable.tsx` — editable preview table for billing

**Modified files:**
- `app/(portal)/layout.tsx` — no changes needed (admin has own layout)

---

## Task 1: SQL Migration

**Files:**
- No code files — run SQL in Supabase dashboard SQL editor

- [ ] **Step 1: Run migration in Supabase SQL editor**

```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS fulfillment_rate NUMERIC(10,2) DEFAULT 2,
  ADD COLUMN IF NOT EXISTS required_deposit NUMERIC(12,2) DEFAULT 0;
```

- [ ] **Step 2: Verify columns exist**

In Supabase Table Editor, open the `customers` table and confirm `fulfillment_rate` and `required_deposit` columns appear.

---

## Task 2: Service-Role Supabase Client

**Files:**
- Create: `lib/supabase/service.ts`

- [ ] **Step 1: Create the service client**

```ts
// lib/supabase/service.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 2: Add environment variable to Vercel**

In Vercel project settings → Environment Variables, add:
- Key: `SUPABASE_SERVICE_ROLE_KEY`
- Value: found in Supabase project Settings → API → `service_role` secret key

Also add to local `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/service.ts
git commit -m "feat: add service-role supabase client for admin API routes"
```

---

## Task 3: Admin Layout & Auth Guard

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/page.tsx`

- [ ] **Step 1: Create admin layout with auth guard**

```tsx
// app/(admin)/layout.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const NAV = [
  {
    section: 'Upload',
    items: [
      { href: '/admin/upload/orders', label: 'Orders' },
      { href: '/admin/upload/abnormal-orders', label: 'Abnormal Orders' },
      { href: '/admin/upload/shipments', label: 'Shipments' },
      { href: '/admin/upload/freight', label: 'Freight Bills' },
      { href: '/admin/upload/exchange-rates', label: 'Exchange Rates' },
      { href: '/admin/upload/topup', label: 'Top-up Records' },
      { href: '/admin/upload/packaging', label: 'Packaging PO' },
      { href: '/admin/upload/customers', label: 'Customers' },
      { href: '/admin/upload/customer-stores', label: 'Customer Stores' },
    ],
  },
  {
    section: 'Update',
    items: [
      { href: '/admin/update/sku', label: 'SKU' },
      { href: '/admin/update/shipment-status', label: 'Shipment Status' },
      { href: '/admin/update/stock', label: 'Customer Stock' },
    ],
  },
  {
    section: 'Billing',
    items: [
      { href: '/admin/billing', label: 'Run Billing' },
    ],
  },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleRow?.role !== 'admin') redirect('/')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col shrink-0">
        <div className="px-4 py-5 border-b">
          <p className="font-semibold text-gray-900">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section}
              </p>
              {items.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-4 border-t">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-700">
            ← Customer Portal
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create admin home page**

```tsx
// app/(admin)/page.tsx
import { redirect } from 'next/navigation'
export default function AdminPage() {
  redirect('/admin/upload/orders')
}
```

- [ ] **Step 3: Verify admin access works**

Start dev server: `npm run dev`
Navigate to `http://localhost:3000/admin` — should redirect to `/login` if not logged in.
Log in as a non-admin user — should redirect to `/`.
Log in as an admin user — should redirect to `/admin/upload/orders`.

- [ ] **Step 4: Commit**

```bash
git add app/(admin)/layout.tsx app/(admin)/page.tsx
git commit -m "feat: add admin route group with auth guard and sidebar"
```

---

## Task 4: Column Mapping Infrastructure

**Files:**
- Create: `lib/admin/apply-column-map.ts`
- Create: `lib/admin/column-maps/orders.ts`
- Create: `lib/admin/column-maps/shipments.ts`
- Create: `lib/admin/column-maps/freight.ts`
- Create: `lib/admin/column-maps/exchange-rates.ts`
- Create: `lib/admin/column-maps/topup.ts`
- Create: `lib/admin/column-maps/packaging.ts`
- Create: `lib/admin/column-maps/customers.ts`
- Create: `lib/admin/column-maps/customer-stores.ts`
- Create: `lib/admin/column-maps/sku.ts`
- Create: `lib/admin/column-maps/shipment-status.ts`
- Create: `lib/admin/column-maps/stock.ts`

- [ ] **Step 1: Create the apply-column-map utility**

```ts
// lib/admin/apply-column-map.ts
export interface MappingResult {
  rows: Record<string, unknown>[]
  unmappedColumns: string[]
}

export function applyColumnMap(
  rawRows: Record<string, unknown>[],
  columnMap: Record<string, string>
): MappingResult {
  const unmappedSet = new Set<string>()

  const rows = rawRows.map((raw) => {
    const mapped: Record<string, unknown> = {}
    for (const [sourceKey, value] of Object.entries(raw)) {
      const dbKey = columnMap[sourceKey]
      if (dbKey) {
        mapped[dbKey] = value
      } else {
        unmappedSet.add(sourceKey)
      }
    }
    return mapped
  })

  return { rows, unmappedColumns: Array.from(unmappedSet) }
}

export function detectMappedColumns(
  rawHeaders: string[],
  columnMap: Record<string, string>
): { mapped: Array<{ source: string; db: string }>; unmapped: string[] } {
  const mapped: Array<{ source: string; db: string }> = []
  const unmapped: string[] = []
  for (const header of rawHeaders) {
    if (columnMap[header]) {
      mapped.push({ source: header, db: columnMap[header] })
    } else {
      unmapped.push(header)
    }
  }
  return { mapped, unmapped }
}
```

- [ ] **Step 2: Create column map for Orders (and Abnormal Orders — same format)**

> ⚠️ CONFIRM: Verify these Chinese column names against an actual Mabang export before going live. Open a real orders export and compare column headings.

```ts
// lib/admin/column-maps/orders.ts
export const ordersColumnMap: Record<string, string> = {
  '流水号': 'transaction_id',
  '平台单号': 'order_number',
  '店铺': 'store_name',
  '下单时间': 'order_date',
  '订单状态': 'order_status',
  '目的国家': 'country',
  // order_items columns (repeated per row)
  '商品名称': 'product_name',
  'SKU': 'sku',
  '数量': 'qty',
  '货物编号': 'item_id',
}
```

- [ ] **Step 3: Create column map for Shipments**

> ⚠️ CONFIRM: Verify against actual YUNExpress / YANWEN tracking export.

```ts
// lib/admin/column-maps/shipments.ts
export const shipmentsColumnMap: Record<string, string> = {
  '参考号': 'transaction_id',
  '追踪号': 'tracking_no',
  '发货日期': 'dispatch_date',
  '状态': 'shipment_status',
  '承运商': 'carrier',
  '渠道编号': 'channel_id',
  '目的地追踪': 'dest_tracking',
}
```

- [ ] **Step 4: Create column map for Freight Bills**

> ⚠️ CONFIRM: Verify against actual freight billing export.

```ts
// lib/admin/column-maps/freight.ts
export const freightColumnMap: Record<string, string> = {
  '追踪号': 'tracking_no',
  '账单日期': 'billing_date',
  '重量(g)': 'weight_g',
  '运费': 'freight',
  '附加费': 'premium',
}
```

- [ ] **Step 5: Create column map for Exchange Rates**

```ts
// lib/admin/column-maps/exchange-rates.ts
export const exchangeRatesColumnMap: Record<string, string> = {
  '日期': 'transaction_date',
  '汇率': 'exchange_rate',
}
```

- [ ] **Step 6: Create column map for Top-up Records**

```ts
// lib/admin/column-maps/topup.ts
export const topupColumnMap: Record<string, string> = {
  '客户ID': 'customer_id',
  '到账日期': 'date_received',
  '转账金额': 'amount_transferred',
  '到账金额': 'amount_received',
}
```

- [ ] **Step 7: Create column map for Packaging PO**

```ts
// lib/admin/column-maps/packaging.ts
export const packagingColumnMap: Record<string, string> = {
  '采购日期': 'po_date',
  'SKU': 'sku',
  '包装名称': 'packaging_name',
  '数量': 'qty',
  '单价(CNY)': 'unit_price_cny',
  '总费用(CNY)': 'total_cost_cny',
  '汇率': 'exchange_rate_used',
  '账单日期': 'billing_date',
  '金额(USD)': 'usd_amt',
  '备注': 'remarks',
  '店铺': 'store_name',
}
```

- [ ] **Step 8: Create column map for Customers**

```ts
// lib/admin/column-maps/customers.ts
export const customersColumnMap: Record<string, string> = {
  '客户ID': 'customer_id',
  '姓名': 'name',
  '联系方式': 'contact',
  '国家': 'country',
  '保证金': 'deposit_amt',
  '所需保证金': 'required_deposit',
  '履约费率': 'fulfillment_rate',
  '默认汇率': 'default_ex_rate',
  '默认运费': 'default_shipping_rate',
}
```

- [ ] **Step 9: Create column map for Customer Stores**

```ts
// lib/admin/column-maps/customer-stores.ts
export const customerStoresColumnMap: Record<string, string> = {
  '客户ID': 'customer_id',
  '店铺名称': 'store_name',
}
```

- [ ] **Step 10: Create column map for SKU update**

```ts
// lib/admin/column-maps/sku.ts
export const skuColumnMap: Record<string, string> = {
  'SKU': 'sku',
  '商品名称': 'sku_name',
  '成本价(CNY)': 'cny_price',
}
```

- [ ] **Step 11: Create column map for Shipment Status update**

```ts
// lib/admin/column-maps/shipment-status.ts
export const shipmentStatusColumnMap: Record<string, string> = {
  '追踪号': 'tracking_no',
  '状态': 'shipment_status',
}
```

- [ ] **Step 12: Create column map for Customer Stock update**

```ts
// lib/admin/column-maps/stock.ts
export const stockColumnMap: Record<string, string> = {
  '客户ID': 'customer_id',
  'SKU': 'sku',
  '数量': 'qty',
  '快照时间': 'snapshot_at',
}
```

- [ ] **Step 13: Commit**

```bash
git add lib/admin/
git commit -m "feat: add column mapping infrastructure for Chinese ERP exports"
```

---

## Task 5: MappingPreview Component

**Files:**
- Create: `components/admin/MappingPreview.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/MappingPreview.tsx
'use client'

interface MappedColumn { source: string; db: string }

interface Props {
  mapped: MappedColumn[]
  unmapped: string[]
  onConfirm: () => void
  onCancel: () => void
}

export function MappingPreview({ mapped, unmapped, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-1">Column Mapping Preview</h2>
        <p className="text-sm text-gray-500 mb-4">
          Verify that the source columns (from your Excel file) map to the correct database fields.
        </p>

        <div className="overflow-y-auto flex-1 mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Excel Column</th>
                <th className="text-left py-2 font-medium text-gray-600">Database Field</th>
              </tr>
            </thead>
            <tbody>
              {mapped.map(({ source, db }) => (
                <tr key={source} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 text-gray-800">{source}</td>
                  <td className="py-1.5 font-mono text-xs text-gray-600">{db}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {unmapped.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs font-semibold text-yellow-700 mb-1">
                Unmapped columns (will be ignored):
              </p>
              <p className="text-xs text-yellow-600">{unmapped.join(', ')}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Looks good — proceed
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 6: ConflictModal Component

**Files:**
- Create: `components/admin/ConflictModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/admin/ConflictModal.tsx
'use client'

interface Props {
  duplicates: string[]         // list of PKs that already exist
  onConfirm: () => void        // proceed with upsert
  onCancel: () => void
}

export function ConflictModal({ duplicates, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-1 text-orange-600">Duplicate Records Found</h2>
        <p className="text-sm text-gray-600 mb-3">
          {duplicates.length} record{duplicates.length !== 1 ? 's' : ''} already exist in the
          database. Proceeding will overwrite them.
        </p>

        <div className="max-h-40 overflow-y-auto bg-gray-50 rounded border p-2 mb-4">
          {duplicates.map((pk) => (
            <p key={pk} className="text-xs font-mono text-gray-700">{pk}</p>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700"
          >
            Overwrite {duplicates.length} record{duplicates.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 7: FileUploader Component

**Files:**
- Create: `components/admin/FileUploader.tsx`

This is the generic shell used by every upload and update page. It orchestrates: parse → mapping preview → conflict check → upload.

- [ ] **Step 1: Create the component**

```tsx
// components/admin/FileUploader.tsx
'use client'
import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { applyColumnMap, detectMappedColumns } from '@/lib/admin/apply-column-map'
import { MappingPreview } from './MappingPreview'
import { ConflictModal } from './ConflictModal'

interface Props {
  title: string
  apiPath: string                        // e.g. '/api/admin/upload/orders'
  columnMap: Record<string, string>
  onSuccess?: (result: UploadResult) => void
}

interface UploadResult {
  inserted: number
  updated: number
  message?: string
}

type Step = 'idle' | 'mapping' | 'conflict' | 'uploading' | 'done' | 'error'

export function FileUploader({ title, apiPath, columnMap, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mappedRows, setMappedRows] = useState<Record<string, unknown>[]>([])
  const [mappedCols, setMappedCols] = useState<Array<{ source: string; db: string }>>([])
  const [unmappedCols, setUnmappedCols] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      if (rows.length === 0) { setError('File is empty or could not be parsed.'); return }
      const headers = Object.keys(rows[0])
      const { mapped, unmapped } = detectMappedColumns(headers, columnMap)
      setRawRows(rows)
      setMappedCols(mapped)
      setUnmappedCols(unmapped)
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleMappingConfirm() {
    const { rows } = applyColumnMap(rawRows, columnMap)
    setMappedRows(rows)
    await upload(rows, false)
  }

  async function handleConflictConfirm() {
    await upload(mappedRows, true)
  }

  async function upload(rows: Record<string, unknown>[], overwrite: boolean) {
    setStep('uploading')
    setError(null)
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, overwrite }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Upload failed'); setStep('error'); return }
      if (json.duplicates?.length > 0 && !overwrite) {
        setDuplicates(json.duplicates)
        setStep('conflict')
        return
      }
      setResult(json)
      setStep('done')
      onSuccess?.(json)
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  function reset() {
    setStep('idle')
    setRawRows([])
    setMappedRows([])
    setDuplicates([])
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

      {(step === 'idle' || step === 'error') && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-4 text-sm">Select an Excel (.xlsx) file to upload</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            className="block mx-auto text-sm"
          />
          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
            </p>
          )}
        </div>
      )}

      {step === 'uploading' && (
        <div className="p-8 text-center text-gray-500 text-sm">Uploading…</div>
      )}

      {step === 'done' && result && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold text-green-700 mb-1">Upload complete</p>
          <p className="text-sm text-green-600">
            {result.inserted} inserted, {result.updated} updated
            {result.message ? ` — ${result.message}` : ''}
          </p>
          <button onClick={reset} className="mt-4 text-sm text-green-700 underline">
            Upload another file
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <MappingPreview
          mapped={mappedCols}
          unmapped={unmappedCols}
          onConfirm={handleMappingConfirm}
          onCancel={reset}
        />
      )}

      {step === 'conflict' && (
        <ConflictModal
          duplicates={duplicates}
          onConfirm={handleConflictConfirm}
          onCancel={reset}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/
git commit -m "feat: add admin shared components (FileUploader, MappingPreview, ConflictModal)"
```

---

## Task 8: Orders Upload (API + Page)

**Files:**
- Create: `app/api/admin/upload/orders/route.ts`
- Create: `app/(admin)/upload/orders/page.tsx`

Orders Excel has one row per item, order header columns repeated. The API must deduplicate order rows and split into `orders` + `order_items`.

- [ ] **Step 1: Create the API route**

```ts
// app/api/admin/upload/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const ORDER_FIELDS = [
  'transaction_id', 'order_number', 'store_name', 'order_date',
  'order_status', 'country',
]
const ITEM_FIELDS = ['transaction_id', 'sku', 'product_name', 'qty', 'item_id']

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite, isAbnormal = false } = await req.json() as {
      rows: Record<string, unknown>[]
      overwrite: boolean
      isAbnormal?: boolean
    }

    const supabase = createServiceClient()

    // Deduplicate order headers
    const orderMap = new Map<string, Record<string, unknown>>()
    const itemRows: Record<string, unknown>[] = []
    for (const row of rows) {
      const tid = String(row.transaction_id ?? '')
      if (!orderMap.has(tid)) {
        const orderRow: Record<string, unknown> = { is_abnormal: isAbnormal }
        for (const f of ORDER_FIELDS) if (row[f] !== undefined) orderRow[f] = row[f]
        orderMap.set(tid, orderRow)
      }
      const itemRow: Record<string, unknown> = {}
      for (const f of ITEM_FIELDS) if (row[f] !== undefined) itemRow[f] = row[f]
      if (itemRow.sku) itemRows.push(itemRow)
    }

    const orderRows = Array.from(orderMap.values())
    const tids = orderRows.map((r) => r.transaction_id as string)

    // Check for duplicate transaction_ids
    if (!overwrite) {
      const { data: existing } = await supabase
        .from('orders')
        .select('transaction_id')
        .in('transaction_id', tids)
      const dupes = (existing ?? []).map((r) => r.transaction_id)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }

    // Upsert orders
    const { error: ordersErr } = await supabase
      .from('orders')
      .upsert(orderRows, { onConflict: 'transaction_id' })
    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })

    // Upsert order_items
    const { error: itemsErr } = await supabase
      .from('order_items')
      .upsert(itemRows, { onConflict: 'transaction_id,sku' })
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    return NextResponse.json({ inserted: orderRows.length, updated: overwrite ? orderRows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create the Orders upload page**

```tsx
// app/(admin)/upload/orders/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { ordersColumnMap } from '@/lib/admin/column-maps/orders'

export default function UploadOrdersPage() {
  return (
    <div className="p-6">
      <FileUploader
        title="Upload Orders"
        apiPath="/api/admin/upload/orders"
        columnMap={ordersColumnMap}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create the Abnormal Orders upload page**

Abnormal orders use the same API route with `isAbnormal: true`, sent as a custom header via a wrapper.

```tsx
// app/(admin)/upload/abnormal-orders/page.tsx
'use client'
import { FileUploader } from '@/components/admin/FileUploader'
import { ordersColumnMap } from '@/lib/admin/column-maps/orders'

export default function UploadAbnormalOrdersPage() {
  return (
    <div className="p-6">
      <FileUploader
        title="Upload Abnormal Orders"
        apiPath="/api/admin/upload/orders?abnormal=true"
        columnMap={ordersColumnMap}
      />
    </div>
  )
}
```

Update the API route to read the query param:

```ts
// In app/api/admin/upload/orders/route.ts — update destructuring line:
const { rows, overwrite } = await req.json() as { rows: Record<string, unknown>[]; overwrite: boolean }
const isAbnormal = req.nextUrl.searchParams.get('abnormal') === 'true'
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/upload/orders/ app/(admin)/upload/orders/ app/(admin)/upload/abnormal-orders/
git commit -m "feat: add orders and abnormal orders upload"
```

---

## Task 9: Shipments Upload with Multi-Shipment Detection

**Files:**
- Create: `app/api/admin/upload/shipments/route.ts`
- Create: `components/admin/ShipmentConflict.tsx`
- Create: `app/(admin)/upload/shipments/page.tsx`

- [ ] **Step 1: Create the API route**

```ts
// app/api/admin/upload/shipments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite, resolvedTrackingNos } = await req.json() as {
      rows: Record<string, unknown>[]
      overwrite: boolean
      resolvedTrackingNos?: Record<string, string> // transaction_id → chosen tracking_no
    }

    const supabase = createServiceClient()

    // Group rows by transaction_id to detect multi-shipment orders
    const byOrder = new Map<string, Record<string, unknown>[]>()
    for (const row of rows) {
      const tid = String(row.transaction_id ?? '')
      if (!byOrder.has(tid)) byOrder.set(tid, [])
      byOrder.get(tid)!.push(row)
    }

    // If any order has >1 shipment and no resolution provided, return conflict list
    const multiShipment: Array<{ transaction_id: string; shipments: Record<string, unknown>[] }> = []
    for (const [tid, shipments] of byOrder) {
      if (shipments.length > 1 && !resolvedTrackingNos?.[tid]) {
        multiShipment.push({ transaction_id: tid, shipments })
      }
    }
    if (multiShipment.length > 0) {
      return NextResponse.json({ multiShipment })
    }

    // Build final rows: for multi-shipment orders, keep only the chosen one
    const finalRows: Record<string, unknown>[] = []
    for (const [tid, shipments] of byOrder) {
      if (shipments.length === 1) {
        finalRows.push(shipments[0])
      } else {
        const chosen = resolvedTrackingNos![tid]
        const row = shipments.find((s) => s.tracking_no === chosen)
        if (row) finalRows.push(row)
      }
    }

    const trackingNos = finalRows.map((r) => r.tracking_no as string)

    // Check duplicates
    if (!overwrite) {
      const { data: existing } = await supabase
        .from('order_shipment')
        .select('tracking_no')
        .in('tracking_no', trackingNos)
      const dupes = (existing ?? []).map((r) => r.tracking_no)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }

    // For multi-shipment resolutions, delete the rejected rows first
    for (const [tid, shipments] of byOrder) {
      if (shipments.length > 1 && resolvedTrackingNos?.[tid]) {
        const rejectedNos = shipments
          .map((s) => s.tracking_no as string)
          .filter((no) => no !== resolvedTrackingNos![tid])
        if (rejectedNos.length > 0) {
          await supabase.from('order_shipment').delete().in('tracking_no', rejectedNos)
        }
      }
    }

    const { error } = await supabase
      .from('order_shipment')
      .upsert(finalRows, { onConflict: 'tracking_no' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ inserted: finalRows.length, updated: overwrite ? finalRows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create the ShipmentConflict component**

```tsx
// components/admin/ShipmentConflict.tsx
'use client'
import { useState } from 'react'

interface Shipment { tracking_no: string; dispatch_date?: unknown; carrier?: unknown }
interface MultiShipmentOrder { transaction_id: string; shipments: Shipment[] }

interface Props {
  orders: MultiShipmentOrder[]
  onConfirm: (selections: Record<string, string>) => void
  onCancel: () => void
}

export function ShipmentConflict({ orders, onConfirm, onCancel }: Props) {
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const o of orders) init[o.transaction_id] = o.shipments[0].tracking_no
    return init
  })

  const allSelected = orders.every((o) => selections[o.transaction_id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-1 text-orange-600">Multiple Shipments Detected</h2>
        <p className="text-sm text-gray-600 mb-4">
          {orders.length} order{orders.length !== 1 ? 's have' : ' has'} more than one shipment row.
          Select the valid shipment for each. Others will be deleted.
        </p>

        <div className="overflow-y-auto flex-1 space-y-4 mb-4">
          {orders.map((order) => (
            <div key={order.transaction_id} className="border rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Order: <span className="font-mono">{order.transaction_id}</span>
              </p>
              <div className="space-y-2">
                {order.shipments.map((s) => (
                  <label key={s.tracking_no} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name={order.transaction_id}
                      value={s.tracking_no}
                      checked={selections[order.transaction_id] === s.tracking_no}
                      onChange={() =>
                        setSelections((prev) => ({ ...prev, [order.transaction_id]: s.tracking_no }))
                      }
                    />
                    <span className="text-sm">
                      <span className="font-mono">{s.tracking_no}</span>
                      {s.carrier && <span className="ml-2 text-gray-500">{String(s.carrier)}</span>}
                      {s.dispatch_date && (
                        <span className="ml-2 text-gray-400">{String(s.dispatch_date)}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selections)}
            disabled={!allSelected}
            className="px-4 py-2 text-sm rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
          >
            Confirm selections
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the Shipments upload page**

```tsx
// app/(admin)/upload/shipments/page.tsx
'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { applyColumnMap, detectMappedColumns } from '@/lib/admin/apply-column-map'
import { shipmentsColumnMap } from '@/lib/admin/column-maps/shipments'
import { MappingPreview } from '@/components/admin/MappingPreview'
import { ConflictModal } from '@/components/admin/ConflictModal'
import { ShipmentConflict } from '@/components/admin/ShipmentConflict'

type Step = 'idle' | 'mapping' | 'conflict' | 'multishipment' | 'uploading' | 'done' | 'error'

interface MultiShipmentOrder {
  transaction_id: string
  shipments: Record<string, unknown>[]
}

export default function UploadShipmentsPage() {
  const [step, setStep] = useState<Step>('idle')
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mappedRows, setMappedRows] = useState<Record<string, unknown>[]>([])
  const [mappedCols, setMappedCols] = useState<Array<{ source: string; db: string }>>([])
  const [unmappedCols, setUnmappedCols] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [multiShipment, setMultiShipment] = useState<MultiShipmentOrder[]>([])
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })
      if (rows.length === 0) { setError('File is empty.'); return }
      const headers = Object.keys(rows[0])
      const { mapped, unmapped } = detectMappedColumns(headers, shipmentsColumnMap)
      setRawRows(rows)
      setMappedCols(mapped)
      setUnmappedCols(unmapped)
      setStep('mapping')
    }
    reader.readAsArrayBuffer(file)
  }

  async function upload(rows: Record<string, unknown>[], overwrite: boolean, resolvedTrackingNos?: Record<string, string>) {
    setStep('uploading')
    const res = await fetch('/api/admin/upload/shipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, overwrite, resolvedTrackingNos }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setStep('error'); return }
    if (json.multiShipment) { setMultiShipment(json.multiShipment); setStep('multishipment'); return }
    if (json.duplicates?.length > 0 && !overwrite) { setDuplicates(json.duplicates); setStep('conflict'); return }
    setResult(json)
    setStep('done')
  }

  function handleMappingConfirm() {
    const { rows } = applyColumnMap(rawRows, shipmentsColumnMap)
    setMappedRows(rows)
    upload(rows, false)
  }

  function reset() {
    setStep('idle'); setRawRows([]); setMappedRows([]); setDuplicates([])
    setMultiShipment([]); setResult(null); setError(null)
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Shipments</h1>

      {(step === 'idle' || step === 'error') && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-4 text-sm">Select an Excel (.xlsx) file to upload</p>
          <input type="file" accept=".xlsx" onChange={handleFile} className="block mx-auto text-sm" />
          {error && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
        </div>
      )}
      {step === 'uploading' && <div className="p-8 text-center text-gray-500 text-sm">Uploading…</div>}
      {step === 'done' && result && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold text-green-700">Upload complete</p>
          <p className="text-sm text-green-600">{result.inserted} inserted, {result.updated} updated</p>
          <button onClick={reset} className="mt-4 text-sm text-green-700 underline">Upload another file</button>
        </div>
      )}
      {step === 'mapping' && (
        <MappingPreview mapped={mappedCols} unmapped={unmappedCols} onConfirm={handleMappingConfirm} onCancel={reset} />
      )}
      {step === 'conflict' && (
        <ConflictModal duplicates={duplicates} onConfirm={() => upload(mappedRows, true)} onCancel={reset} />
      )}
      {step === 'multishipment' && (
        <ShipmentConflict
          orders={multiShipment}
          onConfirm={(selections) => upload(mappedRows, false, selections)}
          onCancel={reset}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/upload/shipments/ components/admin/ShipmentConflict.tsx app/(admin)/upload/shipments/
git commit -m "feat: add shipments upload with multi-shipment conflict resolution"
```

---

## Task 10: Remaining Simple Uploads (6 routes + 6 pages)

All six follow the same pattern as the Orders upload. Create one API route and one page per upload type.

**Files:**
- Create: `app/api/admin/upload/freight/route.ts`
- Create: `app/api/admin/upload/exchange-rates/route.ts`
- Create: `app/api/admin/upload/topup/route.ts`
- Create: `app/api/admin/upload/packaging/route.ts`
- Create: `app/api/admin/upload/customers/route.ts`
- Create: `app/api/admin/upload/customer-stores/route.ts`
- Create: `app/(admin)/upload/freight/page.tsx`
- Create: `app/(admin)/upload/exchange-rates/page.tsx`
- Create: `app/(admin)/upload/topup/page.tsx`
- Create: `app/(admin)/upload/packaging/page.tsx`
- Create: `app/(admin)/upload/customers/page.tsx`
- Create: `app/(admin)/upload/customer-stores/page.tsx`

- [ ] **Step 1: Create freight upload API route**

```ts
// app/api/admin/upload/freight/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const trackingNos = rows.map((r: Record<string, unknown>) => r.tracking_no as string)
    if (!overwrite) {
      const { data } = await supabase.from('freight').select('tracking_no').in('tracking_no', trackingNos)
      const dupes = (data ?? []).map((r) => r.tracking_no)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('freight').upsert(rows, { onConflict: 'tracking_no' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create exchange-rates upload API route**

```ts
// app/api/admin/upload/exchange-rates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const dates = rows.map((r: Record<string, unknown>) => r.transaction_date as string)
    if (!overwrite) {
      const { data } = await supabase.from('exchange_rate').select('transaction_date').in('transaction_date', dates)
      const dupes = (data ?? []).map((r) => r.transaction_date)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('exchange_rate').upsert(rows, { onConflict: 'transaction_date' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create top-up records upload API route**

Note: `amount_received` has a SERIAL PK (`transaction_no`). Duplicate check is based on `customer_id + date_received + amount_received`.

```ts
// app/api/admin/upload/topup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    if (!overwrite) {
      // Check for exact match on customer_id + date_received + amount_received
      const dupes: string[] = []
      for (const row of rows) {
        const { data } = await supabase
          .from('amount_received')
          .select('transaction_no')
          .eq('customer_id', row.customer_id)
          .eq('date_received', row.date_received)
          .eq('amount_received', row.amount_received)
          .limit(1)
        if (data && data.length > 0) {
          dupes.push(`${row.customer_id} / ${row.date_received} / ${row.amount_received}`)
        }
      }
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    // For top-up, always insert (no upsert — SERIAL PK is auto-generated)
    const { error } = await supabase.from('amount_received').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create packaging PO upload API route**

Note: PK is `(po_date, sku)`.

```ts
// app/api/admin/upload/packaging/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    if (!overwrite) {
      const dupes: string[] = []
      for (const row of rows) {
        const { data } = await supabase
          .from('packaging_po')
          .select('po_date')
          .eq('po_date', row.po_date)
          .eq('sku', row.sku)
          .limit(1)
        if (data && data.length > 0) dupes.push(`${row.po_date} / ${row.sku}`)
      }
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase
      .from('packaging_po')
      .upsert(rows, { onConflict: 'po_date,sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 5: Create customers upload API route**

```ts
// app/api/admin/upload/customers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const ids = rows.map((r: Record<string, unknown>) => r.customer_id as string)
    if (!overwrite) {
      const { data } = await supabase.from('customers').select('customer_id').in('customer_id', ids)
      const dupes = (data ?? []).map((r) => r.customer_id)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('customers').upsert(rows, { onConflict: 'customer_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 6: Create customer-stores upload API route**

Note: PK is `(customer_id, store_name)`.

```ts
// app/api/admin/upload/customer-stores/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    if (!overwrite) {
      const dupes: string[] = []
      for (const row of rows) {
        const { data } = await supabase
          .from('customer_store')
          .select('store_name')
          .eq('customer_id', row.customer_id)
          .eq('store_name', row.store_name)
          .limit(1)
        if (data && data.length > 0) dupes.push(`${row.customer_id} / ${row.store_name}`)
      }
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase
      .from('customer_store')
      .upsert(rows, { onConflict: 'customer_id,store_name' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: rows.length, updated: overwrite ? rows.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 7: Create the 6 upload pages (all identical structure)**

```tsx
// app/(admin)/upload/freight/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { freightColumnMap } from '@/lib/admin/column-maps/freight'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Freight Bills" apiPath="/api/admin/upload/freight" columnMap={freightColumnMap} /></div>
}
```

```tsx
// app/(admin)/upload/exchange-rates/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { exchangeRatesColumnMap } from '@/lib/admin/column-maps/exchange-rates'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Exchange Rates" apiPath="/api/admin/upload/exchange-rates" columnMap={exchangeRatesColumnMap} /></div>
}
```

```tsx
// app/(admin)/upload/topup/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { topupColumnMap } from '@/lib/admin/column-maps/topup'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Top-up Records" apiPath="/api/admin/upload/topup" columnMap={topupColumnMap} /></div>
}
```

```tsx
// app/(admin)/upload/packaging/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { packagingColumnMap } from '@/lib/admin/column-maps/packaging'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Packaging PO" apiPath="/api/admin/upload/packaging" columnMap={packagingColumnMap} /></div>
}
```

```tsx
// app/(admin)/upload/customers/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { customersColumnMap } from '@/lib/admin/column-maps/customers'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Customers" apiPath="/api/admin/upload/customers" columnMap={customersColumnMap} /></div>
}
```

```tsx
// app/(admin)/upload/customer-stores/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { customerStoresColumnMap } from '@/lib/admin/column-maps/customer-stores'
export default function Page() {
  return <div className="p-6"><FileUploader title="Upload Customer Stores" apiPath="/api/admin/upload/customer-stores" columnMap={customerStoresColumnMap} /></div>
}
```

- [ ] **Step 8: Create upload menu page**

```tsx
// app/(admin)/upload/page.tsx
import Link from 'next/link'
const UPLOADS = [
  { href: '/admin/upload/orders', label: 'Orders', desc: 'Regular fulfillment orders + line items' },
  { href: '/admin/upload/abnormal-orders', label: 'Abnormal Orders', desc: 'Resend and claim orders' },
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
```

- [ ] **Step 9: Commit**

```bash
git add app/api/admin/upload/ app/(admin)/upload/
git commit -m "feat: add remaining upload modules (freight, exchange rates, topup, packaging, customers, stores)"
```

---

## Task 11: Update Modules (SKU, Shipment Status, Customer Stock)

**Files:**
- Create: `app/api/admin/update/sku/route.ts`
- Create: `app/api/admin/update/shipment-status/route.ts`
- Create: `app/api/admin/update/stock/route.ts`
- Create: `app/(admin)/update/sku/page.tsx`
- Create: `app/(admin)/update/shipment-status/page.tsx`
- Create: `app/(admin)/update/stock/page.tsx`
- Create: `app/(admin)/update/page.tsx`

- [ ] **Step 1: Create SKU update API route**

```ts
// app/api/admin/update/sku/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const skus = rows.map((r: Record<string, unknown>) => r.sku as string)
    if (!overwrite) {
      const { data } = await supabase.from('sku').select('sku').in('sku', skus)
      const dupes = (data ?? []).map((r) => r.sku)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase.from('sku').upsert(rows, { onConflict: 'sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: 0, updated: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create shipment status update API route**

```ts
// app/api/admin/update/shipment-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    const trackingNos = rows.map((r: Record<string, unknown>) => r.tracking_no as string)
    if (!overwrite) {
      const { data } = await supabase.from('order_shipment').select('tracking_no').in('tracking_no', trackingNos)
      const dupes = (data ?? []).map((r) => r.tracking_no)
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    // Only update the status field
    let updatedCount = 0
    for (const row of rows) {
      const { error } = await supabase
        .from('order_shipment')
        .update({ shipment_status: row.shipment_status })
        .eq('tracking_no', row.tracking_no)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      updatedCount++
    }
    return NextResponse.json({ inserted: 0, updated: updatedCount })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create customer stock update API route**

Note: PK is `(customer_id, sku)`.

```ts
// app/api/admin/update/stock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const { rows, overwrite } = await req.json()
    const supabase = createServiceClient()
    if (!overwrite) {
      const dupes: string[] = []
      for (const row of rows) {
        const { data } = await supabase
          .from('customer_stock')
          .select('sku')
          .eq('customer_id', row.customer_id)
          .eq('sku', row.sku)
          .limit(1)
        if (data && data.length > 0) dupes.push(`${row.customer_id} / ${row.sku}`)
      }
      if (dupes.length > 0) return NextResponse.json({ duplicates: dupes })
    }
    const { error } = await supabase
      .from('customer_stock')
      .upsert(rows, { onConflict: 'customer_id,sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: 0, updated: rows.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create the 3 update pages**

```tsx
// app/(admin)/update/sku/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { skuColumnMap } from '@/lib/admin/column-maps/sku'
export default function Page() {
  return <div className="p-6"><FileUploader title="Update SKU" apiPath="/api/admin/update/sku" columnMap={skuColumnMap} /></div>
}
```

```tsx
// app/(admin)/update/shipment-status/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { shipmentStatusColumnMap } from '@/lib/admin/column-maps/shipment-status'
export default function Page() {
  return <div className="p-6"><FileUploader title="Update Shipment Status" apiPath="/api/admin/update/shipment-status" columnMap={shipmentStatusColumnMap} /></div>
}
```

```tsx
// app/(admin)/update/stock/page.tsx
import { FileUploader } from '@/components/admin/FileUploader'
import { stockColumnMap } from '@/lib/admin/column-maps/stock'
export default function Page() {
  return <div className="p-6"><FileUploader title="Update Customer Stock" apiPath="/api/admin/update/stock" columnMap={stockColumnMap} /></div>
}
```

- [ ] **Step 5: Create update menu page**

```tsx
// app/(admin)/update/page.tsx
import Link from 'next/link'
const UPDATES = [
  { href: '/admin/update/sku', label: 'SKU', desc: 'Update SKU names and CNY prices' },
  { href: '/admin/update/shipment-status', label: 'Shipment Status', desc: 'Update tracking shipment statuses' },
  { href: '/admin/update/stock', label: 'Customer Stock', desc: 'Update customer inventory quantities' },
]
export default function UpdateMenuPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Update Records</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {UPDATES.map(({ href, label, desc }) => (
          <Link key={href} href={href} className="block p-4 bg-white border rounded-lg hover:border-blue-400 hover:shadow-sm transition">
            <p className="font-medium text-gray-900">{label}</p>
            <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/update/ app/(admin)/update/
git commit -m "feat: add update modules for SKU, shipment status, and customer stock"
```

---

## Task 12: Billing Preview API

**Files:**
- Create: `app/api/admin/billing/preview/route.ts`

Takes a list of `transaction_id`s and a `billing_date`. Returns per-order calculated amounts.

- [ ] **Step 1: Create the preview route**

```ts
// app/api/admin/billing/preview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export interface BillingPreviewRow {
  transaction_id: string
  store_name: string
  order_date: string
  customer_id: string
  customer_name: string
  cog_usd: number
  shipping_usd: number
  fulfillment_usd: number
  freight_found: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { orderIds, billingDate } = await req.json() as {
      orderIds: string[]
      billingDate: string
    }

    const supabase = createServiceClient()

    // 1. Look up exchange rate
    const { data: rateRow } = await supabase
      .from('exchange_rate')
      .select('exchange_rate')
      .eq('transaction_date', billingDate)
      .single()

    if (!rateRow) {
      return NextResponse.json(
        { error: `No exchange rate found for ${billingDate}. Please upload an exchange rate first.` },
        { status: 422 }
      )
    }
    const exRate = Number(rateRow.exchange_rate)

    // 2. Fetch orders
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('transaction_id, store_name, order_date')
      .in('transaction_id', orderIds)
    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })

    // 3. Fetch order_items for COG calculation
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('transaction_id, sku, qty')
      .in('transaction_id', orderIds)
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    // 4. Fetch SKU prices
    const skus = [...new Set((items ?? []).map((i) => i.sku))]
    const { data: skuRows } = await supabase.from('sku').select('sku, cny_price').in('sku', skus)
    const skuPriceMap = new Map((skuRows ?? []).map((s) => [s.sku, Number(s.cny_price ?? 0)]))

    // 5. Fetch shipments to get tracking numbers
    const { data: shipments } = await supabase
      .from('order_shipment')
      .select('transaction_id, tracking_no')
      .in('transaction_id', orderIds)
    const shipmentMap = new Map((shipments ?? []).map((s) => [s.transaction_id, s.tracking_no]))

    // 6. Fetch freight costs
    const trackingNos = [...new Set([...shipmentMap.values()].filter(Boolean))]
    const { data: freightRows } = await supabase
      .from('freight')
      .select('tracking_no, freight')
      .in('tracking_no', trackingNos)
    const freightMap = new Map((freightRows ?? []).map((f) => [f.tracking_no, Number(f.freight ?? 0)]))

    // 7. Fetch customer fulfillment rates via store_name → customer_store → customers
    const storeNames = [...new Set((orders ?? []).map((o) => o.store_name).filter(Boolean))]
    const { data: storeRows } = await supabase
      .from('customer_store')
      .select('store_name, customer_id')
      .in('store_name', storeNames)
    const storeToCustomer = new Map((storeRows ?? []).map((s) => [s.store_name, s.customer_id]))
    const customerIds = [...new Set([...storeToCustomer.values()])]
    const { data: customerRows } = await supabase
      .from('customers')
      .select('customer_id, name, fulfillment_rate')
      .in('customer_id', customerIds)
    const customerMap = new Map(
      (customerRows ?? []).map((c) => [c.customer_id, { name: c.name, fulfillment_rate: Number(c.fulfillment_rate ?? 2) }])
    )

    // 8. Build COG map
    const cogMap = new Map<string, number>()
    for (const item of (items ?? [])) {
      const price = skuPriceMap.get(item.sku) ?? 0
      const qty = Number(item.qty ?? 0)
      cogMap.set(item.transaction_id, (cogMap.get(item.transaction_id) ?? 0) + price * qty)
    }

    // 9. Build preview rows
    const preview: BillingPreviewRow[] = (orders ?? []).map((order) => {
      const cogCny = cogMap.get(order.transaction_id) ?? 0
      const trackingNo = shipmentMap.get(order.transaction_id)
      const freightCny = trackingNo ? (freightMap.get(trackingNo) ?? 0) : 0
      const customerId = storeToCustomer.get(order.store_name) ?? ''
      const customer = customerMap.get(customerId)

      return {
        transaction_id: order.transaction_id,
        store_name: order.store_name,
        order_date: order.order_date,
        customer_id: customerId,
        customer_name: customer?.name ?? '',
        cog_usd: Math.round((cogCny / exRate) * 100) / 100,
        shipping_usd: Math.round((freightCny / exRate) * 100) / 100,
        fulfillment_usd: customer?.fulfillment_rate ?? 2,
        freight_found: !!trackingNo && freightMap.has(trackingNo),
      }
    })

    return NextResponse.json({ preview, exRate })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

---

## Task 13: Billing Confirm API

**Files:**
- Create: `app/api/admin/billing/confirm/route.ts`

- [ ] **Step 1: Create the confirm route**

```ts
// app/api/admin/billing/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

interface OrderBilling {
  transaction_id: string
  cog_usd: number
  shipping_usd: number
  fulfillment_usd: number
}

export async function POST(req: NextRequest) {
  try {
    const { billingDate, exRateUsed, orders } = await req.json() as {
      billingDate: string
      exRateUsed: number
      orders: OrderBilling[]
    }

    const supabase = createServiceClient()
    let updatedCount = 0

    for (const order of orders) {
      const { error } = await supabase
        .from('orders')
        .update({
          billing_date: billingDate,
          ex_rate_used: exRateUsed,
          cog_usd: order.cog_usd,
          shipping_usd: order.shipping_usd,
          fulfillment_usd: order.fulfillment_usd,
        })
        .eq('transaction_id', order.transaction_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      updatedCount++
    }

    return NextResponse.json({ updated: updatedCount })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/billing/
git commit -m "feat: add billing preview and confirm API routes"
```

---

## Task 14: Billing UI

**Files:**
- Create: `components/admin/BillingTable.tsx`
- Create: `app/(admin)/billing/page.tsx`

- [ ] **Step 1: Create the BillingTable component**

```tsx
// components/admin/BillingTable.tsx
'use client'
import { useState } from 'react'

export interface BillingRow {
  transaction_id: string
  store_name: string
  order_date: string
  customer_name: string
  cog_usd: number
  shipping_usd: number
  fulfillment_usd: number
  freight_found: boolean
}

interface Props {
  rows: BillingRow[]
  onChange: (updated: BillingRow[]) => void
}

export function BillingTable({ rows, onChange }: Props) {
  function updateField(idx: number, field: keyof BillingRow, value: string) {
    const updated = rows.map((row, i) =>
      i === idx ? { ...row, [field]: parseFloat(value) || 0 } : row
    )
    onChange(updated)
  }

  const total = rows.reduce(
    (s, r) => s + r.cog_usd + r.shipping_usd + r.fulfillment_usd,
    0
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left py-2 px-3 font-medium text-gray-600">Transaction ID</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Store</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Customer</th>
            <th className="text-left py-2 px-3 font-medium text-gray-600">Order Date</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">COG (USD)</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Freight (USD)</th>
            <th className="text-right py-2 px-3 font-medium text-gray-600">Fulfillment (USD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.transaction_id} className="border-b hover:bg-gray-50">
              <td className="py-2 px-3 font-mono text-xs">{row.transaction_id}</td>
              <td className="py-2 px-3">{row.store_name}</td>
              <td className="py-2 px-3">{row.customer_name}</td>
              <td className="py-2 px-3">{row.order_date}</td>
              <td className="py-2 px-3">
                <input
                  type="number"
                  step="0.01"
                  value={row.cog_usd}
                  onChange={(e) => updateField(idx, 'cog_usd', e.target.value)}
                  className="w-24 text-right border rounded px-2 py-0.5 text-sm"
                />
              </td>
              <td className="py-2 px-3">
                <input
                  type="number"
                  step="0.01"
                  value={row.shipping_usd}
                  onChange={(e) => updateField(idx, 'shipping_usd', e.target.value)}
                  className={`w-24 text-right border rounded px-2 py-0.5 text-sm ${!row.freight_found ? 'border-yellow-400 bg-yellow-50' : ''}`}
                  title={!row.freight_found ? 'No freight record found for this order' : undefined}
                />
              </td>
              <td className="py-2 px-3">
                <input
                  type="number"
                  step="0.01"
                  value={row.fulfillment_usd}
                  onChange={(e) => updateField(idx, 'fulfillment_usd', e.target.value)}
                  className="w-24 text-right border rounded px-2 py-0.5 text-sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 font-semibold bg-gray-50">
            <td colSpan={4} className="py-2 px-3 text-right text-gray-600">Total</td>
            <td colSpan={3} className="py-2 px-3 text-right">${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create the billing page**

```tsx
// app/(admin)/billing/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import { BillingPageClient } from './BillingPageClient'

export default async function BillingPage() {
  const supabase = createServiceClient()
  const { data: orders } = await supabase
    .from('orders')
    .select('transaction_id, store_name, order_date, is_abnormal')
    .is('billing_date', null)
    .order('order_date', { ascending: false })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Run Billing</h1>
      <BillingPageClient unbilledOrders={orders ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Create the BillingPageClient component**

```tsx
// app/(admin)/billing/BillingPageClient.tsx
'use client'
import { useState } from 'react'
import { BillingTable, BillingRow } from '@/components/admin/BillingTable'

interface UnbilledOrder {
  transaction_id: string
  store_name: string
  order_date: string
  is_abnormal: boolean
}

interface Props {
  unbilledOrders: UnbilledOrder[]
}

type Step = 'select' | 'preview' | 'confirming' | 'done' | 'error'

export function BillingPageClient({ unbilledOrders }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [billingDate, setBillingDate] = useState('')
  const [step, setStep] = useState<Step>('select')
  const [previewRows, setPreviewRows] = useState<BillingRow[]>([])
  const [exRate, setExRate] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState(0)

  function toggleAll() {
    if (selected.size === unbilledOrders.length) setSelected(new Set())
    else setSelected(new Set(unbilledOrders.map((o) => o.transaction_id)))
  }

  async function runPreview() {
    if (selected.size === 0 || !billingDate) return
    setError(null)
    const res = await fetch('/api/admin/billing/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: [...selected], billingDate }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); return }
    setPreviewRows(json.preview)
    setExRate(json.exRate)
    setStep('preview')
  }

  async function confirmBilling() {
    setStep('confirming')
    const res = await fetch('/api/admin/billing/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingDate,
        exRateUsed: exRate,
        orders: previewRows.map((r) => ({
          transaction_id: r.transaction_id,
          cog_usd: r.cog_usd,
          shipping_usd: r.shipping_usd,
          fulfillment_usd: r.fulfillment_usd,
        })),
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setStep('error'); return }
    setDoneCount(json.updated)
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg max-w-md">
        <p className="font-semibold text-green-700">Billing complete</p>
        <p className="text-sm text-green-600">{doneCount} orders billed on {billingDate}</p>
      </div>
    )
  }

  if (step === 'preview' || step === 'confirming') {
    return (
      <div>
        <div className="mb-4 flex items-center gap-4">
          <p className="text-sm text-gray-600">
            Billing date: <span className="font-semibold">{billingDate}</span>
            {' '}· Exchange rate: <span className="font-semibold">{exRate}</span>
          </p>
          <p className="text-sm text-yellow-600">
            Orders with yellow freight cells have no matching freight record — review before confirming.
          </p>
        </div>
        <BillingTable rows={previewRows} onChange={setPreviewRows} />
        <div className="mt-6 flex gap-3">
          <button onClick={() => setStep('select')} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
            ← Back
          </button>
          <button
            onClick={confirmBilling}
            disabled={step === 'confirming'}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {step === 'confirming' ? 'Confirming…' : `Confirm billing for ${previewRows.length} orders`}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="mb-6 flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Billing Date</label>
          <input
            type="date"
            value={billingDate}
            onChange={(e) => setBillingDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={runPreview}
          disabled={selected.size === 0 || !billingDate}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
        >
          Preview billing for {selected.size} order{selected.size !== 1 ? 's' : ''}
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="py-2 px-3 w-8">
                <input
                  type="checkbox"
                  checked={selected.size === unbilledOrders.length && unbilledOrders.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Transaction ID</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Store</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Order Date</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Type</th>
            </tr>
          </thead>
          <tbody>
            {unbilledOrders.map((order) => (
              <tr key={order.transaction_id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3">
                  <input
                    type="checkbox"
                    checked={selected.has(order.transaction_id)}
                    onChange={() => {
                      const next = new Set(selected)
                      next.has(order.transaction_id) ? next.delete(order.transaction_id) : next.add(order.transaction_id)
                      setSelected(next)
                    }}
                  />
                </td>
                <td className="py-2 px-3 font-mono text-xs">{order.transaction_id}</td>
                <td className="py-2 px-3">{order.store_name}</td>
                <td className="py-2 px-3">{order.order_date}</td>
                <td className="py-2 px-3">
                  {order.is_abnormal ? (
                    <span style={{ color: '#b45309', background: '#fffbeb', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>Abnormal</span>
                  ) : (
                    <span style={{ color: '#15803d', background: '#f0fdf4', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>Regular</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/BillingTable.tsx app/(admin)/billing/
git commit -m "feat: add billing UI (order selection, preview with overrides, confirm)"
```

---

## Task 15: Final Build & Deploy

- [ ] **Step 1: Build locally to catch TypeScript errors**

```bash
cd "D:\WPSDrive\1207746729\WPS云盘\杰纳思理新品\customer-portal"
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 2: Test admin routes manually**

Start dev server: `npm run dev`

Checklist:
- Navigate to `http://localhost:3000/admin` — redirects to login if not authenticated
- Log in as non-admin — redirected to `/`
- Log in as admin — see admin sidebar
- Navigate to `/admin/upload/orders` — file input visible
- Upload a test `.xlsx` file — mapping preview shows
- Navigate to `/admin/billing` — unbilled orders table visible

- [ ] **Step 3: Add SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables**

In Vercel dashboard → project → Settings → Environment Variables:
- Add `SUPABASE_SERVICE_ROLE_KEY` with the service role key from Supabase Settings → API

- [ ] **Step 4: Deploy**

```bash
git push origin main
```

Vercel will auto-deploy. Monitor build logs in Vercel dashboard.
