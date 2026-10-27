# Customer Portal 数据库架构说明

> 最后更新：2026-10-13  
> 数据库：Supabase PostgreSQL  
> 本文档帮助新开发人员快速了解数据库结构、表关系、安全策略和核心业务逻辑。

---

## 目录

1. [数据库总览](#1-数据库总览)
2. [ER 关系图](#2-er-关系图)
3. [表结构详解](#3-表结构详解)
4. [枚举类型定义](#4-枚举类型定义)
5. [View 视图](#5-view-视图)
6. [函数与存储过程](#6-函数与存储过程)
7. [触发器](#7-触发器)
8. [RLS 安全策略](#8-rls-安全策略)
9. [汇率回退机制](#9-汇率回退机制)
10. [计费数据同步架构](#10-计费数据同步架构)
11. [数据流转全景图](#11-数据流转全景图)
12. [常见查询示例](#12-常见查询示例)
13. [迁移脚本索引](#13-迁移脚本索引)

---

## 1. 数据库总览

### 1.1 表清单

| 表名 | 说明 | 数据量级 | RLS |
|------|------|---------|-----|
| **orders** | 订单表（基本信息） | 大 | ✅ 按客户过滤 |
| **order_pricing** | 订单价格表 | 大 | ❌ |
| **order_items** | 订单商品明细 | 大 | ❌ |
| **order_shipment** | 运单信息 | 中 | ❌ |
| **order_billing** | 订单账单（敏感） | 中 | ✅ 仅管理员 |
| **freight** | 运费账单 | 中 | ❌ |
| **customers** | 客户信息 | 小 | ❌ |
| **customer_store** | 客户店铺关联 | 小 | ❌ |
| **customer_stock** | 客户库存快照 | 中 | ❌ |
| **sku** | SKU 价格表 | 中 | ❌ |
| **packaging_po** | 包装采购订单 | 小 | ❌ |
| **amount_received** | 充值记录 | 小 | ❌ |
| **exchange_rate** | 汇率历史 | 小 | ❌ |
| **system_config** | 系统配置 | 极小 | ✅ 仅管理员 |
| **user_roles** | 用户角色 | 极小 | ❌ |

### 1.2 View 清单

| View 名称 | 说明 |
|-----------|------|
| **orders_with_billing_display** | 订单 + 计费显示视图（根据 bill_issued 动态计算） |
| **order_billing_calc_view** | 计费计算视图（从 SKU/客户费率动态计算 COG、运费、fulfillment） |

---

## 2. ER 关系图

```
┌─────────────┐     1:N     ┌──────────────┐
│   orders    │────────────→│ order_items  │
│ (基本信息)  │             │ (商品明细)    │
└──────┬──────┘             └──────────────┘
       │
       │ 1:1
       ├──────────────→┌────────────────┐
       │               │ order_pricing  │
       │               │ (价格信息)      │
       │               └───────┬────────┘
       │                       │
       │                trigger│同步
       │                       ↓
       │               order_billing 计费数据
       │
       │ 1:1              1:1
       │                    │
       ├──────────────→┌────────────────┐
       │               │ order_billing  │
       │               │ (账单, 敏感)    │
       │               └────────────────┘
       │
       │ N:1
       ├──────────────→ store_name
       │                    │
       │               ┌────┴───────────┐
       │               │ customer_store │
       │               │ (店铺关联)      │
       │               └────┬───────────┘
       │                    │ N:1
       │                    ↓
       │               ┌────────────────┐
       └──────────────→│  customers     │ ← auth_user_id 关联 Supabase Auth
                       │ (客户信息)      │
                       └────────────────┘
```

### 关键关联关系

| 关系 | 关联字段 | 类型 |
|------|---------|------|
| orders → order_pricing | transaction_id | 1:1 (PK = FK) |
| orders → order_items | transaction_id | 1:N |
| orders → order_shipment | transaction_id | 1:N |
| orders → order_billing | transaction_id | 1:1 (PK = FK) |
| order_pricing → order_billing | transaction_id | 1:1 (触发器同步目标) |
| orders → customer_store | store_name | N:1 |
| customer_store → customers | customer_id | N:1 |
| customers → Supabase Auth | auth_user_id | 1:1 |
| order_shipment → freight | tracking_no | N:1 |
| freight → order_shipment | tracking_no | 1:1 |
| customer_stock → customers | customer_id | N:1 |
| amount_received → customers | customer_id | N:1 |
| packaging_po → customer_store | store_name | N:1 |

---

## 3. 表结构详解

### 3.1 orders（订单表 - 基本信息）

存储订单基本信息（不含价格数据）。价格数据存储在 `order_pricing` 表中。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **transaction_id** | TEXT | PK | 交易ID（唯一标识） |
| **order_number** | NUMERIC | | 订单号（一个订单号可对应多个 transaction_id） |
| **store_name** | TEXT | | 店铺名称（关联 customer_store） |
| **order_date** | DATE | | 订单日期 |
| **shipment_date** | DATE | | 交运日期（Shipment Date） |
| **dispatch_date** | DATE | | 发货时间 |
| **order_status** | order_status_enum | | 订单状态 |
| **country** | TEXT | | 目的国家 |
| **post_code** | TEXT | | 邮编（Postal Code） |
| **is_abnormal** | BOOLEAN | DEFAULT false | 是否异常订单 |
| **abnormal_code** | abnormal_code_enum | | 异常代码（仅异常订单有值） |
| **remarks** | TEXT | | 备注（中文，前端翻译显示） |
| **is_return** | BOOLEAN | DEFAULT false | 是否退货 |
| **return_qty** | NUMERIC | | 退货数量 |
| **return_sign_date** | DATE | | 退货签收入库时间 |
| **cancel_date** | DATE | | 作废日期（Cancel Date） |
| **updated_at** | TIMESTAMPTZ | DEFAULT NOW() | 更新时间戳 |

### 3.1.1 order_pricing（订单价格表）

存储订单价格信息和计费显示字段。触发器自动从 `order_billing` 同步计费数据。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **transaction_id** | TEXT | PK, FK → orders | 交易ID（1:1 关联 orders） |
| **order_cny_value** | NUMERIC(12,2) | | 订单原始人民币金额 |
| **order_ex_rate** | NUMERIC(10,4) | | 订单汇率（非美元汇率，不用于计费） |
| **currency** | TEXT | DEFAULT 'USD' | 币种（Currency） |
| **cog_usd** | NUMERIC(10,2) | | ⚡ COG USD 显示值（触发器同步） |
| **shipping_usd** | NUMERIC(10,2) | | ⚡ Shipping USD 显示值（触发器同步） |
| **fulfillment_usd** | NUMERIC(10,2) | | ⚡ Fulfillment USD 显示值（触发器同步） |
| **total_cost_usd** | NUMERIC(10,2) | | ⚡ 总成本 USD 显示值（触发器同步） |
| **ex_rate_used** | NUMERIC(10,4) | | ⚡ 实际使用的汇率（触发器同步） |
| **billing_date** | DATE | | ⚡ 账单日期（仅 bill_issued=true 时同步） |
| **updated_at** | TIMESTAMPTZ | DEFAULT NOW() | 更新时间戳 |

> ⚡ 标记的字段由 `trigger_sync_billing_to_orders` 触发器自动从 `order_billing` 同步。

### 3.2 order_items（订单商品明细）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **transaction_id** | TEXT | FK → orders | 关联交易ID |
| **item_id** | TEXT | | 商品ID（来自 ERP） |
| **sku** | TEXT | | 商品 SKU |
| **product_name** | TEXT | | 商品名称 |
| **sku_standard_price** | NUMERIC(10,2) | | 库存 SKU 标准售价 |
| **qty** | NUMERIC | | 数量 |
| **platform_product_title** | TEXT | | 平台商品标题 |
| **sku_image_url** | TEXT | | SKU 原始图片链接 |

### 3.3 order_shipment（运单信息）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **tracking_no** | TEXT | PK | 运单号（唯一） |
| **transaction_id** | TEXT | FK → orders | 关联交易ID |
| **carrier** | TEXT | | 物流商（英文枚举值，如 YUNExpress、HH EXPRESS） |
| **dispatch_date** | DATE | | 发货日期 |
| **shipment_status** | shipment_status_enum | | 运单状态 |
| **channel_id** | TEXT | | 渠道ID |
| **dest_tracking** | TEXT | | 目的国追踪号 |

### 3.4 order_billing（订单账单）⚠️ 敏感数据

存储 COG、运费、fulfillment 等计费原始数据。**RLS 保护，仅管理员可访问**。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **transaction_id** | TEXT | PK, FK → orders | 交易ID（1:1 关系） |
| **cog_cny** | NUMERIC(12,2) | | COG 人民币金额 |
| **cog_premium_cny** | NUMERIC(12,2) | DEFAULT 0 | COG 溢价 |
| **freight_est_cny** | NUMERIC(12,2) | | 估算运费人民币 |
| **cog_billed_usd** | NUMERIC(10,2) | | COG 账单美元（出账后填入） |
| **freight_billed_usd** | NUMERIC(10,2) | | 运费账单美元（出账后填入） |
| **fulfillment_usd** | NUMERIC(10,2) | | Fulfillment 费用美元 |
| **total_cost_usd** | NUMERIC(10,2) | | 总成本美元（出账后计算存储） |
| **ex_rate_used** | NUMERIC(10,4) | | 账单使用的汇率 |
| **billing_date** | DATE | | 账单日期 |
| **bill_issued** | BOOLEAN | DEFAULT false | 是否已出账 |
| **created_at** | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| **updated_at** | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**索引**：
- `idx_order_billing_bill_issued` ON (bill_issued)
- `idx_order_billing_billing_date` ON (billing_date)
- `idx_order_billing_transaction_id` ON (transaction_id)

### 3.5 freight（运费账单）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **tracking_no** | TEXT | PK | 运单号（关联 order_shipment） |
| **billing_date** | DATE | | 账单日期 |
| **weight_g** | NUMERIC | | 重量（克） |
| **freight** | NUMERIC | | 运费金额 |
| **premium** | NUMERIC | | 附加费 |

### 3.6 customers（客户信息）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **customer_id** | TEXT | PK | 客户ID |
| **name** | TEXT | | 客户姓名 |
| **contact** | TEXT | | 联系方式 |
| **country** | TEXT | | 国家 |
| **deposit_amt** | NUMERIC | | 保证金 |
| **fulfillment_rate** | NUMERIC | | 履约费率（USD） |
| **default_ex_rate** | NUMERIC | | 默认汇率 |
| **default_shipping_rate** | NUMERIC | | 默认运费率 |
| **required_deposit** | NUMERIC | | 要求保证金 |
| **auth_user_id** | UUID | | Supabase Auth 用户ID |

### 3.7 customer_store（客户店铺关联）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **customer_id** | TEXT | PK (联合) | 客户ID |
| **store_name** | TEXT | PK (联合) | 店铺名称（唯一标识一个店铺） |

> 联合主键：(customer_id, store_name)

### 3.8 customer_stock（客户库存快照）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **customer_id** | TEXT | PK (联合) | 客户ID |
| **sku** | TEXT | PK (联合) | SKU |
| **qty** | NUMERIC | | 数量 |
| **snapshot_at** | TEXT | | 快照时间 |

> 联合主键：(customer_id, sku)

### 3.9 sku（SKU 价格表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **sku** | TEXT | PK | SKU 编码 |
| **sku_name** | TEXT | | 商品名称 |
| **cny_price** | NUMERIC | | 人民币采购价 |

### 3.10 packaging_po（包装采购订单）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **po_date** | DATE | PK (联合) | PO 日期 |
| **sku** | TEXT | PK (联合) | SKU |
| **packaging_name** | TEXT | | 包装名称 |
| **qty** | NUMERIC | | 数量 |
| **unit_price_cny** | NUMERIC | | 单价（CNY） |
| **total_cost_cny** | NUMERIC | | 总费用（CNY） |
| **exchange_rate_used** | NUMERIC | | 使用汇率 |
| **billing_date** | DATE | | 账单日期 |
| **usd_amt** | NUMERIC | | 美元金额 |
| **remarks** | TEXT | | 备注 |
| **store_name** | TEXT | | 店铺名称 |

> 联合主键：(po_date, sku)

### 3.11 amount_received（充值记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **customer_id** | TEXT | | 客户ID |
| **date_received** | DATE | | 到账日期 |
| **amount_transferred** | NUMERIC | | 转账金额 |
| **amount_received** | NUMERIC | | 到账金额 |
| **difference** | NUMERIC | | 差额 |
| **transaction_no** | TEXT | | 交易号 |

### 3.12 exchange_rate（汇率历史）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **transaction_date** | DATE | PK | 日期 |
| **ex_rate** | NUMERIC | | 汇率 |

### 3.13 system_config（系统配置）⚠️ 仅管理员

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **config_key** | TEXT | PK | 配置键 |
| **config_value** | TEXT | NOT NULL | 配置值 |
| **description** | TEXT | | 说明 |
| **updated_at** | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**默认配置项**：

| config_key | config_value | 说明 |
|-----------|-------------|------|
| default_exchange_rate | 6.75 | 默认 USD/CNY 汇率 |

### 3.14 user_roles（用户角色）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| **user_id** | UUID | | Supabase Auth 用户ID |
| **role** | TEXT | | 角色：`admin` 或 `customer` |

---

## 4. 枚举类型定义

### 4.1 order_status_enum

```sql
'received' | 'processed' | 'shipped' | 'cancelled'
```

| 值 | 中文 | 说明 |
|----|------|------|
| received | 待处理 | 订单已接收 |
| processed | 配货中 | 订单处理中 |
| shipped | 已发货 | 已发货 |
| cancelled | 已取消 | 已作废 |

### 4.2 shipment_status_enum

```sql
'created' | 'shipped' | 'cancelled' | 'delivered'
```

| 值 | 中文 | 说明 |
|----|------|------|
| created | 已预报 | 运单已创建 |
| shipped | 已发货 | 运输中 |
| cancelled | 已取消/已删除 | 运单已取消 |
| delivered | 已签收 | 已送达 |

### 4.3 abnormal_code_enum

```sql
'package_lost' | 'customer_request' | 'amend_info' | 'defective' | 'damaged'
| 'wrong_item' | 'missing_item' | 'change_shipping' | 'shopify_error'
```

| 值 | 中文 | 说明 |
|----|------|------|
| package_lost | 包裹丢失 | |
| customer_request | 客户要求 | 客户主动要求重发/修改 |
| amend_info | 修改信息 | 客户修改订单信息 |
| defective | 质量问题 | |
| damaged | 破损 | |
| wrong_item | 发错货 | |
| missing_item | 漏发 | |
| change_shipping | 物流更改 | |
| shopify_error | 系统错误 | Shopify 系统异常 |

---

## 5. View 视图

### 5.1 orders_with_billing_display

**用途**：前端显示订单计费数据的核心视图。

**逻辑**：
- `bill_issued = true`（已出账）→ 直接使用 `cog_billed_usd`、`freight_billed_usd` 等 billed 值
- `bill_issued = false`（未出账）→ 从 CNY 金额通过汇率估算 USD

**输出字段**：

| 字段 | 说明 |
|------|------|
| transaction_id | 交易ID |
| order_number | 订单号 |
| store_name | 店铺 |
| order_date, dispatch_date | 日期 |
| order_status, country, abnormal_code | 状态 |
| bill_issued | 是否已出账 |
| effective_ex_rate | 实际使用的汇率（4层回退） |
| cog_usd | COG 美元（billed 或估算） |
| shipping_usd | 运费美元（billed 或估算） |
| fulfillment_usd | 履约费用美元 |
| total_cost_usd | 总成本美元 |

> **注意**：此 View 继承 `order_billing` 表的 RLS 策略，普通用户**无法直接查询**此 View。  
> 普通用户通过 `orders` 表的触发器同步字段获取计费数据。

### 5.2 order_billing_calc_view

**用途**：从 SKU 价格和客户费率动态计算每个订单的计费数据（用于计费预览）。

**计算逻辑**：
- `cog_cny` = SUM(sku.cny_price × order_items.qty)
- `freight_est_cny` = customer.default_shipping_rate × system_config.default_exchange_rate
- `fulfillment_usd` = customer.fulfillment_rate

---

## 6. 函数与存储过程

### 6.1 get_default_exchange_rate()

```sql
RETURNS NUMERIC(10,4)
```

**功能**：获取默认汇率，基于历史账单中 `ex_rate_used` 的平均值。

**回退逻辑**：
```
AVG(ex_rate_used from orders) → 6.75 (兜底)
```

### 6.2 sync_billing_to_orders()

```sql
RETURNS TRIGGER
```

**功能**：触发器函数，将 `order_billing` 的计费数据同步到 `orders` 表的显示字段。

**同步规则**：

| order_billing 字段 | orders 表字段 | 条件 |
|-------------------|--------------|------|
| cog_billed_usd / 估算值 | cog_usd | 总是同步 |
| freight_billed_usd / 估算值 | shipping_usd | 总是同步 |
| fulfillment_usd | fulfillment_usd | 总是同步 |
| total_cost_usd / 估算值 | total_cost_usd | 总是同步 |
| ex_rate_used (回退后) | ex_rate_used | 总是同步 |
| billing_date | billing_date | **仅 bill_issued = true** |

### 6.3 update_bill_issued_status(transaction_id, bill_issued)

```sql
RETURNS VOID
```

**功能**：手动更新单个订单的 `bill_issued` 状态。

### 6.4 batch_update_bill_issued(transaction_ids[], bill_issued)

```sql
RETURNS INTEGER (更新记录数)
```

**功能**：批量更新多个订单的 `bill_issued` 状态。

---

## 7. 触发器

### trigger_sync_billing_to_orders

```sql
CREATE TRIGGER trigger_sync_billing_to_orders
AFTER INSERT OR UPDATE ON order_billing
FOR EACH ROW
EXECUTE FUNCTION sync_billing_to_orders();
```

**触发时机**：`order_billing` 表发生 INSERT 或 UPDATE 时自动触发。

**作用**：将计费数据同步到 `order_pricing` 表的冗余显示字段，使普通用户无需直接访问 `order_billing` 表即可看到账单金额。

**重要**：触发器使用与 `orders_with_billing_display` View **完全相同**的计算逻辑（包括 4 层汇率回退），确保数据一致性。

---

## 8. RLS 安全策略

### 8.1 策略总览

| 表 | RLS | 管理员 | 普通用户 |
|----|-----|--------|---------|
| order_billing | ✅ 已启用 | ✅ 完全访问 | ❌ 禁止访问 |
| system_config | ✅ 已启用 | ✅ 完全访问 | ❌ 禁止访问 |
| orders | ✅ 已启用 | ✅ 完全访问（通过 Service Role） | ✅ 按店铺过滤 |
| 其他表 | ❌ 未启用 | ✅ 通过 Service Role 访问 | 通过 API 层控制 |

### 8.2 order_billing RLS

```sql
-- 仅管理员可查看
CREATE POLICY "Admins can view all billing records"
ON order_billing FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin')
);

-- 仅管理员可管理
CREATE POLICY "Admins can manage all billing records"
ON order_billing FOR ALL TO authenticated
USING (...) WITH CHECK (...);  -- 同上条件
```

### 8.3 system_config RLS

与 `order_billing` 相同，仅管理员可访问。

### 8.4 数据访问控制流程

```
普通用户请求
    ↓
Supabase Anon Key（遵守 RLS）
    ↓
orders 表 → 通过 store_name → customer_store → customers.auth_user_id 过滤
    ↓
返回当前客户自己店铺的订单（含 cog_usd, shipping_usd 等显示字段）

管理员请求
    ↓
Supabase Service Role Key（绕过 RLS）
    ↓
可访问所有表的所有数据
    ↓
包括 order_billing 原始账单数据
```

---

## 9. 汇率回退机制

当 `order_billing.ex_rate_used` 为空时，系统使用 4 层回退机制确定汇率：

```
优先级 1: order_billing.ex_rate_used          ← 账单汇率（最精确）
    ↓ (如果为 NULL)
优先级 2: system_config.default_exchange_rate  ← 配置表默认值 (当前 6.75)
    ↓ (如果配置不存在)
优先级 3: get_default_exchange_rate()          ← 动态计算历史平均值
    ↓ (如果无历史数据)
优先级 4: 6.75                                 ← 硬编码兜底值
```

**SQL 实现**：
```sql
COALESCE(
    ob.ex_rate_used,
    (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
    get_default_exchange_rate(),
    6.75
)
```

> **注意**：不使用 `orders.order_ex_rate`，因为它不一定是美元汇率。

---

## 10. 计费数据同步架构

### 10.1 双写架构

```
┌──────────────────────────────────────────┐
│           order_billing 表                │
│  (原始计费数据，仅管理员可访问)             │
│                                          │
│  cog_cny, freight_est_cny     ← CNY 原始 │
│  cog_billed_usd, freight_billed_usd      │
│  fulfillment_usd, total_cost_usd         │
│  bill_issued, billing_date               │
└────────────────┬─────────────────────────┘
                 │
                 │ INSERT / UPDATE
                 ↓
┌──────────────────────────────────────────┐
│     trigger_sync_billing_to_orders        │
│     (AFTER INSERT OR UPDATE)              │
│                                          │
│  计算逻辑：                               │
│  bill_issued=true  → 使用 billed 值       │
│  bill_issued=false → CNY / 汇率 = USD    │
│  汇率：4 层回退机制                       │
└────────────────┬─────────────────────────┘
                 │
                 │ 自动写入
                 ↓
┌──────────────────────────────────────────┐
│           order_pricing 表                │
│  (价格显示字段，所有用户可通过 RLS 查询)    │
│                                          │
│  cog_usd          ← 显示用 COG USD       │
│  shipping_usd     ← 显示用 Shipping USD  │
│  fulfillment_usd  ← 显示用 Fulfillment   │
│  total_cost_usd   ← 显示用总计           │
│  ex_rate_used     ← 实际使用汇率          │
│  billing_date     ← 账单日期 (条件同步)   │
└──────────────────────────────────────────┘
```

### 10.2 同步规则

| 场景 | cog_usd | shipping_usd | billing_date | ex_rate_used |
|------|---------|-------------|-------------|-------------|
| bill_issued = true | cog_billed_usd | freight_billed_usd | 同步 | 账单汇率 |
| bill_issued = false | (cog_cny + premium) / rate | freight_est_cny / rate | NULL | 回退后的汇率 |
| bill_issued true → false | 切换为估算值 | 切换为估算值 | 清空 | 重新回退 |

---

## 11. 数据流转全景图

```
═══════════════════ 数据导入阶段 ═══════════════════

Excel 文件 ──→ Admin Upload API ──→ Service Role Key (绕过 RLS)
                                        │
                    ┌───────────────────┼───────────────────┐
                    ↓                   ↓                   ↓
              orders + order_items  order_shipment     freight
              customers / stores    (运单匹配)         (运费记录)
              sku / stock
              packaging_po
              amount_received
              exchange_rate

═══════════════════ 计费阶段 ═══════════════════

Admin Billing Page
       │
       ↓
order_billing_calc_view (动态计算 COG / 运费 / fulfillment)
       │
       ↓
  管理员确认 → INSERT INTO order_billing
       │
       ↓ (触发 trigger)
  orders 表显示字段自动更新
       │
       ↓
  设置 bill_issued = true → 触发 trigger
       │
       ↓
  orders.billing_date 同步, 显示值切换为 billed

═══════════════════ 客户查看阶段 ═══════════════════

客户登录 → Supabase Auth
       │
       ↓
  Anon Key (遵守 RLS)
       │
       ↓
  SELECT * FROM orders
  WHERE store_name IN (
      SELECT store_name FROM customer_store
      WHERE customer_id = (
          SELECT customer_id FROM customers
          WHERE auth_user_id = auth.uid()
      )
  )
       │
       ↓
  显示订单列表 + cog_usd / shipping_usd / total_cost_usd
```

---

## 12. 常见查询示例

### 12.1 查询客户订单（含计费显示）

```sql
-- 前端实际使用的方式（通过 Supabase Client，自动 RLS 过滤）
SELECT transaction_id, order_number, store_name, order_date,
       cog_usd, shipping_usd, fulfillment_usd, total_cost_usd,
       billing_date, ex_rate_used, order_status
FROM orders
WHERE is_abnormal = false
ORDER BY order_date DESC;
```

### 12.2 管理员查看计费详情

```sql
-- 管理员通过 Service Role 查询原始账单数据
SELECT o.transaction_id, o.store_name, o.order_date,
       ob.cog_cny, ob.cog_premium_cny, ob.freight_est_cny,
       ob.cog_billed_usd, ob.freight_billed_usd,
       ob.fulfillment_usd, ob.total_cost_usd,
       ob.ex_rate_used, ob.billing_date, ob.bill_issued
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id
ORDER BY o.order_date DESC;
```

### 12.3 查询客户库存

```sql
SELECT cs.sku, s.sku_name, cs.qty, s.cny_price,
       cs.qty * s.cny_price as stock_value_cny
FROM customer_stock cs
JOIN sku s ON cs.sku = s.sku
WHERE cs.customer_id = 'C001';
```

### 12.4 查询充值余额

```sql
-- 充值总额
SELECT SUM(amount_received) as total_received
FROM amount_received
WHERE customer_id = 'C001';

-- 已出账消费总额
SELECT SUM(total_cost_usd) as total_billed
FROM orders
WHERE store_name IN (
    SELECT store_name FROM customer_store WHERE customer_id = 'C001'
)
AND billing_date IS NOT NULL;

-- 包装消费总额
SELECT SUM(usd_amt) as total_packaging
FROM packaging_po
WHERE store_name IN (
    SELECT store_name FROM customer_store WHERE customer_id = 'C001'
)
AND billing_date IS NOT NULL;
```

### 12.5 手动触发同步（修复数据用）

```sql
-- 强制触发所有 order_billing 记录的同步
UPDATE order_billing SET updated_at = NOW();
```

---

## 13. 迁移脚本索引

### 核心迁移（按执行顺序）

| # | 文件 | 说明 |
|---|------|------|
| 1 | `001_create_order_billing_table.sql` | 创建 order_billing 表、system_config 表、辅助函数、View、RLS |
| 2 | `002_add_billing_display_fields.sql` | 添加 orders 表显示字段、创建同步触发器 |
| 3 | `update_sync_trigger_ex_rate.sql` | 更新触发器，添加 ex_rate_used 同步 |
| 4 | `003_split_orders_to_pricing.sql` | 拆分 orders 表：创建 order_pricing 表，迁移价格数据，更新触发器和视图 |

### 辅助迁移

| 文件 | 说明 |
|------|------|
| `add-order-cny-fields.sql` | 添加 order_cny_value, order_ex_rate |
| `add-order-dates.sql` | 添加 process_date, dispatch_date |
| `add-total-cost-usd-to-orders.sql` | 添加 total_cost_usd |
| `add-new-carriers.sql` | 添加 HH EXPRESS, XJ LOGISTICS 枚举 |
| `add-yun-express-enum.sql` | 添加 delivered, cancelled 运单状态 |
| `add-amend-info-abnormal-code.sql` | 添加 amend_info 异常代码 |
| `add-updated-at-column.sql` | 添加 orders.updated_at |
| `create-order-billing-view.sql` | 创建 order_billing_calc_view |
| `add-return-sign-date.sql` | 添加 orders.return_sign_date（退货签收入库时间） |

---

## 附录：前端 TypeScript 类型定义

```typescript
// lib/types.ts

type OrderStatus = 'received' | 'processed' | 'shipped' | 'cancelled'
type ShipmentStatus = 'created' | 'shipped' | 'cancelled'
type Carrier = string  // 物流公司英文枚举值，参见 source/lib/carrier-config.ts
type AbnormalCode =
  | 'package_lost' | 'customer_request' | 'amend_info' | 'defective'
  | 'damaged' | 'wrong_item' | 'missing_item' | 'change_shipping' | 'shopify_error'

interface Order {
  transaction_id: string
  order_number: number
  store_name: string
  order_date: string
  shipment_date: string | null
  dispatch_date: string | null
  order_status: OrderStatus
  country: string | null
  post_code: string | null
  is_abnormal: boolean
  abnormal_code: AbnormalCode | null
  remarks: string | null
  is_return: boolean
  return_qty: number | null
  return_sign_date: string | null
  cancel_date: string | null
  tracking_no: string | null       // joined from order_shipment
  carrier: Carrier | null          // joined from order_shipment
  shipment_status: ShipmentStatus | null  // joined from order_shipment
  dest_tracking: string | null     // joined from order_shipment
}

interface OrderPricing {
  transaction_id: string
  order_cny_value: number | null
  order_ex_rate: number | null
  currency: string | null  // 默认 'USD'
  cog_usd: number | null
  shipping_usd: number | null
  fulfillment_usd: number | null
  total_cost_usd: number | null
  ex_rate_used: number | null
  billing_date: string | null
}

interface OrderItem {
  transaction_id: string
  item_id: string
  sku: string
  product_name: string
  sku_standard_price: number | null
  qty: number
  platform_product_title: string | null
  sku_image_url: string | null
}
```
