# Admin Interface Design

**Date:** 2026-06-08
**Project:** JNSL Customer Portal (jnsl-web-portal.vercel.app)
**Scope:** Admin-facing interface for uploading data, updating records, and running billing

---

## 1. Architecture & Auth

**Approach:** Route group `(admin)` inside the existing Next.js 15 app (`customer-portal`).

- Admin routes live at `/admin/*`
- Middleware (`proxy.ts`) checks `user_roles.role = 'admin'` for all `/admin` routes; non-admins are redirected to `/`
- API routes under `app/api/admin/` use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
- Admin layout (`app/(admin)/layout.tsx`) has its own sidebar with Upload, Update, and Billing nav items
- No new project, no separate deployment — same Vercel project

---

## 2. Upload Modules

All uploads accept Excel `.xlsx` format. Each upload follows the same flow:

1. Admin selects file → client parses with `xlsx` library
2. **Duplicate PK validation**: parsed rows are checked against existing DB records
3. If duplicates found: show conflict table → prompt "These records already exist. Overwrite?" → on confirm, upsert; on cancel, abort
4. On success: show row count imported/updated

### Upload targets

| Upload | Target Table(s) | Primary Key(s) | Notes |
|---|---|---|---|
| Orders | `orders` + `order_items` | `transaction_id` | One row per item, order headers repeated; sets `is_abnormal = false` |
| Abnormal Orders | `orders` + `order_items` | `transaction_id` | Same format; sets `is_abnormal = true` |
| Shipments | `order_shipment` | `tracking_no` | Multi-shipment detection (see below) |
| Freight Bills | `freight` | `tracking_no` | |
| Exchange Rates | `exchange_rate` | `rate_date` | |
| Top-up Records | `amount_received` | `date_received` + `amount_received` | |
| Packaging PO | `packaging_po` | `po_date` + `packaging_name` | |
| Customers | `customers` | `customer_id` | |
| Customer Stores | `customer_store` | `store_name` | |

### Multi-shipment detection (Shipments upload only)

After parsing the file, rows are grouped by `transaction_id`. For any order with more than one shipment row:

1. Show a conflict resolution modal listing all shipments for that order (tracking no, carrier, dispatch date)
2. Admin selects the valid shipment
3. On confirm: the selected shipment is upserted; all others for that order are deleted from `order_shipment`

---

## 3. Update Modules

Updates accept Excel `.xlsx`. Same duplicate-PK validation flow as uploads (prompt before overwrite).

| Update | Target Table | Match Key | Updatable Fields |
|---|---|---|---|
| SKU | `sku` | `sku` | All non-key fields (product_name, cny_price, etc.) |
| Order Shipment Status | `order_shipment` | `tracking_no` | `shipment_status` |
| Customer Stock | `customer_stock` | `sku` + `customer_id` | `qty`, `snapshot_at` |

---

## 4. Billing Workflow

### Step 1 — Select orders

Admin sees a table of unbilled orders (`billing_date IS NULL`). Columns: transaction_id, store, order date, customer. Checkboxes for individual selection or select-all.

### Step 2 — Pick billing date

Admin enters a date. System queries `exchange_rate` for that date:
- **Found** → proceed
- **Not found** → block with: "No exchange rate for [date]. Please upload an exchange rate first."

### Step 3 — Preview & override

System calculates per order:

| Field | Formula |
|---|---|
| COG (USD) | Σ(`sku.cny_price` × `qty`) ÷ `exchange_rate` |
| Freight (USD) | `freight.freight` ÷ `exchange_rate` (matched via `order_shipment.tracking_no`) |
| Fulfillment (USD) | `customers.fulfillment_rate` (flat per order) |

Admin sees a preview table with all three values per order. Each value cell is editable — admin can type an override before confirming.

### Step 4 — Confirm

On confirm, for each selected order, system writes:

- `billing_date` = selected date
- `ex_rate_used` = exchange rate found
- `cog_usd`, `shipping_usd`, `fulfillment_usd` = calculated or admin-overridden values

Confirmation is final in the UI. Corrections require re-running billing or direct DB edit.

---

## 5. Column Mapping (Chinese ERP → Database)

Excel exports from Mabang and carrier ERP systems have column headings in Chinese. A mapping layer translates these to database field names before any row is processed.

### Approach

Each upload type has a dedicated mapping config file at `lib/admin/column-maps/<upload-type>.ts`. Each config is a plain object: `{ "中文列名": "db_field_name" }`. The `FileUploader` component applies the mapping at parse time before any validation or import logic runs.

**Upload flow with mapping:**
1. Admin selects file → `xlsx` parses raw rows (Chinese headers intact)
2. Mapping config is applied → rows are re-keyed to DB field names
3. **Mapping preview step**: UI shows a two-column table (Source column → DB field) so admin can verify before proceeding. Any source column that has no mapping is flagged in red.
4. Admin confirms the mapping → duplicate PK validation → import

If a source column is unmapped, the admin is warned but can still proceed (unmapped columns are ignored). This handles cases where the ERP adds new columns that aren't needed.

### Example config (`lib/admin/column-maps/orders.ts`)

```ts
export const ordersColumnMap: Record<string, string> = {
  "交易编号": "transaction_id",
  "订单号": "order_number",
  "店铺名称": "store_name",
  "下单日期": "order_date",
  "订单状态": "order_status",
  "国家": "country",
  // order_items fields (repeated per row)
  "商品名称": "product_name",
  "SKU": "sku",
  "数量": "qty",
  "明细ID": "item_id",
}
```

### Config files required (one per upload type)

| File | Upload type |
|---|---|
| `orders.ts` | Orders + Abnormal Orders |
| `shipments.ts` | Shipments |
| `freight.ts` | Freight Bills |
| `exchange-rates.ts` | Exchange Rates |
| `topup.ts` | Top-up Records |
| `packaging.ts` | Packaging PO |
| `customers.ts` | Customers |
| `customer-stores.ts` | Customer Stores |
| `sku.ts` | SKU update |
| `shipment-status.ts` | Shipment Status update |
| `stock.ts` | Customer Stock update |

The actual Chinese column names for each config will be confirmed against real ERP exports during implementation.

---

## 6. SQL Migration Required

Before implementing billing, add `fulfillment_rate` to the `customers` table if not already present:

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS fulfillment_rate NUMERIC(10,2) DEFAULT 2;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS required_deposit NUMERIC(12,2) DEFAULT 0;
```

---

## 6. File Structure

```
app/
  (admin)/
    layout.tsx           # Admin sidebar: Upload, Update, Billing
    page.tsx             # Admin home / redirect to /admin/upload
    upload/
      page.tsx           # Upload menu (list of upload types)
      orders/page.tsx
      abnormal-orders/page.tsx
      shipments/page.tsx
      freight/page.tsx
      exchange-rates/page.tsx
      topup/page.tsx
      packaging/page.tsx
      customers/page.tsx
      customer-stores/page.tsx
    update/
      page.tsx           # Update menu
      sku/page.tsx
      shipment-status/page.tsx
      stock/page.tsx
    billing/
      page.tsx           # Billing workflow (select → date → preview → confirm)
  api/
    admin/
      upload/
        orders/route.ts
        shipments/route.ts
        ... (one route per upload type)
      update/
        sku/route.ts
        shipment-status/route.ts
        stock/route.ts
      billing/
        preview/route.ts
        confirm/route.ts
components/
  admin/
    FileUploader.tsx     # Reusable upload component with conflict modal
    BillingTable.tsx     # Editable billing preview table
    ConflictModal.tsx    # Duplicate PK resolution dialog
    ShipmentConflict.tsx # Multi-shipment resolution modal
    MappingPreview.tsx   # Shows source → DB column mapping before import
lib/
  admin/
    column-maps/         # One config file per upload/update type
      orders.ts
      shipments.ts
      freight.ts
      exchange-rates.ts
      topup.ts
      packaging.ts
      customers.ts
      customer-stores.ts
      sku.ts
      shipment-status.ts
      stock.ts
    apply-column-map.ts  # Utility: re-keys parsed rows using a mapping config
```

---

## 7. Key Constraints

- All admin API routes use `SUPABASE_SERVICE_ROLE_KEY` — never exposed to the browser
- Excel parsing (`xlsx`) runs client-side to avoid large file uploads hitting serverless limits; only the parsed JSON is sent to the API route
- The `FileUploader` component is reused across all upload and update pages — it accepts a schema config describing which columns map to which DB fields
