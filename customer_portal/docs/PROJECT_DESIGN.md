# Customer Portal 项目设计与说明文档

## 1. 项目概述

### 1.1 项目名称
**Customer Portal** — 客户门户与计费管理系统

### 1.2 项目简介
基于 Next.js 16 + Supabase 构建的客户门户系统，面向杰纳思理（JNSL）新品业务。系统分为两大模块：
- **客户门户（Portal）**：客户查看订单、库存、充值记录等
- **管理后台（Admin）**：管理员上传数据、管理运单、运行计费流程

### 1.3 技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16.2.7 + React 19.2.4 |
| UI 组件 | Tailwind CSS 4 + Radix UI + shadcn/ui |
| 数据层 | Supabase (PostgreSQL) |
| 认证 | Supabase Auth (Row Level Security) |
| 部署 | Vercel |
| 语言 | TypeScript 5 |
| Excel 处理 | exceljs + xlsx |

---

## 2. 系统架构

### 2.1 整体架构
```
┌─────────────────────────────────────────────┐
│              Vercel (生产部署)                │
├─────────────────────────────────────────────┤
│                                             │
│  Next.js App Router                         │
│  ├── (portal)/        ← 客户门户页面         │
│  ├── (admin)/admin/   ← 管理后台页面         │
│  ├── api/             ← API Routes          │
│  └── login/           ← 登录页面             │
│                                             │
├─────────────────────────────────────────────┤
│              Supabase (数据层)                │
├─────────────────────────────────────────────┤
│                                             │
│  PostgreSQL                                 │
│  ├── orders              订单表              │
│  ├── order_items         订单商品表          │
│  ├── order_shipment      运单表              │
│  ├── order_billing       账单表              │
│  ├── freight             运费表              │
│  ├── customers           客户表              │
│  ├── customer_stores     客户店铺表          │
│  ├── customer_stock      库存表              │
│  ├── packaging_po        包装采购表          │
│  ├── amount_received     充值记录表          │
│  ├── sku_price           SKU价格表          │
│  ├── system_config       系统配置表          │
│  └── user_roles          用户角色表          │
│                                             │
│  Views                                      │
│  └── orders_with_billing_display  账单显示视图│
│                                             │
│  Functions                                  │
│  ├── get_default_exchange_rate()            │
│  ├── sync_billing_to_orders()               │
│  ├── update_bill_issued_status()            │
│  └── batch_update_bill_issued()             │
│                                             │
│  Triggers                                   │
│  └── trigger_sync_billing_to_orders         │
│                                             │
│  Row Level Security (RLS)                   │
│  ├── order_billing: 仅管理员可访问           │
│  └── system_config: 仅管理员可访问           │
│                                             │
└─────────────────────────────────────────────┘
```

### 2.2 用户角色系统
| 角色 | 权限 |
|------|------|
| **admin** | 访问管理后台，上传/更新数据，运行计费，查看所有账单原始数据 |
| **customer** | 访问客户门户，查看自己店铺的订单、库存、充值记录（通过 RLS 过滤） |

### 2.3 认证流程
```
用户访问 → middleware (proxy.ts) 检查登录状态
  ├── 未登录 → 重定向到 /login
  ├── 已登录 + admin → 允许访问 /admin/*
  └── 已登录 + customer → 允许访问客户门户
```

---

## 3. 核心功能模块

### 3.1 订单管理
- **订单导入**：从 Excel 批量导入订单数据（支持正常订单和异常订单）
- **订单查看**：客户门户展示订单列表，支持按店铺、日期、状态筛选
- **订单分组**：同一 order_number 的多个 transaction_id 自动分组显示
- **异常订单**：支持 resend/claim 类型异常订单的独立管理

### 3.2 运单管理
- **运单导入**：支持多物流商（YunExpress、YANWEN、HH Express、XJ Logistics）
- **二次匹配**：运单通过 tracking_no 与订单关联
- **发货状态更新**：批量更新已发货订单的 dispatch_date 和 shipment_status

### 3.3 运费管理
- **运费账单导入**：支持多物流商的运费 Excel 文件
- **字段映射配置化**：每个物流商的列映射存储在配置文件中
- **重复检测**：自动检测并处理重复运单号

### 3.4 计费系统（Billing）
- **order_billing 表**：存储 COG、运费、fulfillment 等计费数据
- **bill_issued 状态**：区分已出账（billed）和未出账（estimated）
- **显示逻辑**：
  - 已出账 → 直接使用 billed USD 值
  - 未出账 → 从 CNY 通过汇率估算 USD
- **汇率回退机制**：ex_rate_used → system_config → get_default_exchange_rate() → 6.75
- **同步触发器**：order_billing 更新时自动同步显示字段到 orders 表

### 3.5 库存管理
- **库存快照**：展示客户当前库存状态
- **SKU 价格管理**：从 SKU_Price.xlsx 自动更新

### 3.6 充值记录
- **充值历史**：展示客户的充值记录
- **充值统计**：显示总充值金额

### 3.7 包装采购
- **包装 PO 管理**：展示定制包装的采购订单和费用

---

## 4. 数据库设计

### 4.1 核心表结构

#### orders（订单表）
| 字段 | 类型 | 说明 |
|------|------|------|
| transaction_id | TEXT PK | 交易ID |
| order_number | NUMERIC | 订单号 |
| store_name | TEXT | 店铺名称 |
| order_date | DATE | 订单日期 |
| dispatch_date | DATE | 发货日期 |
| billing_date | DATE | 账单日期 |
| order_status | TEXT | 订单状态 |
| is_abnormal | BOOLEAN | 是否异常订单 |
| abnormal_code | TEXT | 异常代码 |
| cog_usd | NUMERIC(10,2) | COG 美元（显示值，触发器同步） |
| shipping_usd | NUMERIC(10,2) | 运费美元（显示值，触发器同步） |
| fulfillment_usd | NUMERIC(10,2) | 履约费用美元（触发器同步） |
| total_cost_usd | NUMERIC(10,2) | 总成本美元（触发器同步） |
| ex_rate_used | NUMERIC(10,4) | 使用的汇率（触发器同步） |
| order_cny_value | NUMERIC(12,2) | 订单人民币金额 |
| order_ex_rate | NUMERIC(10,4) | 订单汇率 |

#### order_billing（账单表）
| 字段 | 类型 | 说明 |
|------|------|------|
| transaction_id | TEXT PK FK | 交易ID（关联 orders） |
| cog_cny | NUMERIC(12,2) | COG 人民币 |
| cog_premium_cny | NUMERIC(12,2) | COG 溢价 |
| freight_est_cny | NUMERIC(12,2) | 估算运费人民币 |
| cog_billed_usd | NUMERIC(10,2) | COG 账单美元 |
| freight_billed_usd | NUMERIC(10,2) | 运费账单美元 |
| fulfillment_usd | NUMERIC(10,2) | 履约费用美元 |
| total_cost_usd | NUMERIC(10,2) | 总成本美元 |
| ex_rate_used | NUMERIC(10,4) | 使用的汇率 |
| billing_date | DATE | 账单日期 |
| bill_issued | BOOLEAN | 是否已出账 |

#### order_shipment（运单表）
| 字段 | 类型 | 说明 |
|------|------|------|
| tracking_no | TEXT | 运单号 |
| transaction_id | TEXT FK | 关联交易ID |
| carrier | TEXT | 物流商 |
| shipment_status | TEXT | 运单状态 |
| dest_tracking | TEXT | 目的国运单号 |

### 4.2 计费数据同步架构

```
order_billing 表（原始数据，仅 admin 可访问）
         │
         │ INSERT / UPDATE
         ↓
trigger_sync_billing_to_orders（触发器）
         │
         │ 自动同步
         ↓
orders 表（显示字段，所有用户可访问，RLS 过滤）
         │
         │ SELECT
         ↓
客户门户 UI（显示账单金额）
```

**同步规则**：
- `bill_issued = true` → 同步 billed 值和 billing_date
- `bill_issued = false` → 从 CNY 估算 USD，清空 billing_date
- `ex_rate_used` → 始终同步，使用 4 层回退机制

### 4.3 汇率回退机制（4 层）
```
1. order_billing.ex_rate_used           ← 账单汇率
2. system_config.default_exchange_rate  ← 配置表默认值 (6.75)
3. get_default_exchange_rate()          ← 动态计算历史平均值
4. 6.75                                 ← 硬编码兜底值
```

---

## 5. 项目文件结构

```
customer-portal/
├── app/                          # Next.js App Router
│   ├── (admin)/admin/            # 管理后台
│   │   ├── billing/              # 计费管理
│   │   ├── upload/               # 数据上传
│   │   └── update/               # 数据更新
│   ├── (portal)/                 # 客户门户
│   │   ├── orders/               # 订单列表
│   │   ├── abnormal-orders/      # 异常订单
│   │   ├── packaging/            # 包装采购
│   │   ├── stock/                # 库存
│   │   └── topup/                # 充值记录
│   ├── api/                      # API Routes
│   └── login/                    # 登录页面
│
├── components/                   # React 组件
│   ├── admin/                    # 管理后台组件
│   └── ui/                       # UI 基础组件 (shadcn/ui)
│
├── lib/                          # 工具库
│   ├── admin/column-maps/        # 列映射配置
│   └── supabase/                 # Supabase 客户端
│
├── database-migrations/          # 数据库迁移脚本
├── tools/                        # 运维工具脚本
├── workflow/                     # 工作流文档
├── docs/                         # 项目文档
├── Data Import/                  # 数据导入文件
│
├── package.json                  # 项目依赖
├── tsconfig.json                 # TypeScript 配置
├── next.config.ts                # Next.js 配置
├── proxy.ts                      # 认证中间件
└── .env.local                    # 环境变量
```

---

## 6. 物流商支持

| 物流商 | 枚举值 | 运单导入 | 运费导入 |
|--------|--------|---------|---------|
| Yun Express | YUNExpress | ✅ | ✅ |
| YANWEN (燕文) | YANWEN | ✅ | ✅ |
| HH Express | HH EXPRESS | ✅ | ✅ |
| XJ Logistics (雄九) | XJ LOGISTICS | ✅ | ✅ |

---

## 7. 安全设计

### 7.1 Row Level Security (RLS)
- **order_billing 表**：仅 admin 角色可访问
- **system_config 表**：仅 admin 角色可访问
- **orders 表**：通过 store_name 关联 customers 表，自动过滤当前用户的订单

### 7.2 API 安全
- 管理 API 使用 **Service Role Key**（绕过 RLS）
- 客户门户使用 **Anon Key**（遵守 RLS）

---

## 8. 数据库迁移脚本

### 8.1 核心迁移脚本（按执行顺序）

| 序号 | 文件 | 说明 |
|------|------|------|
| 1 | `001_create_order_billing_table.sql` | 创建 order_billing 表、system_config 表、辅助函数、View、RLS 策略 |
| 2 | `002_add_billing_display_fields.sql` | 添加显示字段到 orders 表，创建同步触发器 |
| 3 | `update_sync_trigger_ex_rate.sql` | 更新触发器，添加 ex_rate_used 同步 |

### 8.2 辅助迁移脚本

| 文件 | 说明 |
|------|------|
| `add-order-cny-fields.sql` | 添加 order_cny_value, order_ex_rate 字段 |
| `add-order-dates.sql` | 添加日期字段 |
| `add-total-cost-usd-to-orders.sql` | 添加 total_cost_usd 字段 |
| `add-new-carriers.sql` | 添加新物流商枚举值 |
| `add-yun-express-enum.sql` | 添加 YunExpress 枚举 |
| `add-amend-info-abnormal-code.sql` | 添加 amend_info 异常代码 |
| `add-updated-at-column.sql` | 添加 updated_at 字段 |

---

## 9. 运维工具脚本

### 9.1 数据导入工具
| 脚本 | 说明 |
|------|------|
| `import-orders-from-excel.js` | 从 Excel 导入订单（含 SKU 更新） |
| `import-carrier-shipments.js` | 导入物流商运单 |
| `import-freight-bill.js` | 导入运费账单 |
| `import-yunexpress-auto.js` | YunExpress 运单自动导入 |
| `import-yanwen-auto.js` | YANWEN 运单自动导入 |
| `import-xiongjiu-auto.js` | 雄九运单自动导入 |

### 9.2 数据管理工具
| 脚本 | 说明 |
|------|------|
| `cancel-orders.js` | 作废订单（状态更新 + 计费清零 + 备注翻译） |
| `update-shipped-orders.js` | 批量更新已发货订单状态 |
| `export-masahira-orders.js` | 导出特定客户订单 |

---

## 10. 环境变量配置

```env
NEXT_PUBLIC_SUPABASE_URL=https://xogpaptciobeonditjry.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

---

## 11. 部署说明

```bash
# 本地开发
npm install
npm run dev

# 生产部署
vercel --prod
```

---

## 12. 当前开发进度

### 12.1 已完成功能
- ✅ 订单管理（导入、查看、分组、异常订单）
- ✅ 运单管理（多物流商导入、二次匹配、状态更新）
- ✅ 运费管理（多物流商运费导入、字段映射配置化）
- ✅ 计费系统（order_billing 表、触发器同步、View 显示、汇率回退、RLS）
- ✅ 安全设计（RLS 策略、角色控制、API 安全）
- ✅ 库存管理（库存快照、SKU 价格管理）
- ✅ 充值记录（充值历史、统计）
- ✅ 包装采购（包装 PO 管理）
- ✅ 作废订单工作流（状态更新 + 计费清零 + 备注翻译）
- ✅ 数据导出（订单、异常订单、库存、包装、充值）

### 12.2 待完善功能
- ⏳ 前端代码中部分页面仍使用旧的查询方式
- ⏳ 计费确认流程的完善

---

## 13. 关键文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| **数据库架构** | `docs/DATABASE_SCHEMA.md` | **完整数据库结构说明（新开发人员必读）** |
| 计费视图逻辑 | `docs/BILLING_VIEW_LOGIC_EXPLANATION.md` | View 计算逻辑详解 |
| 计费访问架构 | `docs/BILLING_ACCESS_ARCHITECTURE.md` | RLS 与数据访问控制 |
| 同步触发器指南 | `docs/BILLING_SYNC_TRIGGER_GUIDE.md` | 触发器实施指南 |
| RLS 安全配置 | `docs/RLS_SECURITY_CONFIGURATION.md` | 行级安全策略 |
| 汇率回退机制 | `docs/DEFAULT_EXCHANGE_RATE_MECHANISM.md` | 默认汇率机制 |
| 订单导入工作流 | `workflow/ORDER_IMPORT_WORKFLOW.md` | 订单导入流程 |
| 运单导入工作流 | `workflow/CARRIER_SHIPMENT_IMPORT_WORKFLOW.md` | 运单导入流程 |
| 运费导入工作流 | `workflow/FREIGHT_BILL_IMPORT_WORKFLOW.md` | 运费导入流程 |
| 作废订单工作流 | `workflow/CANCEL_ORDERS_WORKFLOW.md` | 作废订单流程 |
