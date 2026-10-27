# 账单数据访问架构 - RLS 策略修正

## 📅 更新日期
2026-08-10

## ⚠️ 重要修正

之前的设计中，普通用户可以直接查询 `order_billing` 表是**错误的**。

### 正确的架构 ✅

```
┌─────────────────────────────────────────────────┐
│           前端应用 (Vercel App)                  │
└──────────────────┬──────────────────────────────┘
                   │
                   │ HTTP Requests
                   ↓
┌─────────────────────────────────────────────────┐
│         API Routes (Next.js)                     │
│  - /api/admin/billing/*  (Service Role Key)     │
│  - /api/orders/*         (Anon Key + RLS)       │
└──────────────────┬──────────────────────────────┘
                   │
                   │ Database Queries
                   ↓
┌─────────────────────────────────────────────────┐
│        PostgreSQL (Supabase)                     │
├─────────────────────────────────────────────────┤
│                                                  │
│  order_billing 表                                │
│    ├── RLS: 仅 admin 可访问                      │
│    └── 普通用户 ❌ 无法直接查询                   │
│                                                  │
│  orders_with_billing_display View               │
│    ├── 继承 order_billing 的 RLS                 │
│    └── 普通用户 ❌ 无法直接查询                   │
│                                                  │
│  orders 表                                       │
│    ├── RLS: 基于 store_name 过滤                 │
│    └── 普通用户 ✅ 可以查询自己的订单             │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 🔐 修正后的 RLS 策略

### order_billing 表（仅 2 条策略）

#### 策略 1: 管理员查看所有账单
```sql
CREATE POLICY "Admins can view all billing records"
ON order_billing
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);
```

#### 策略 2: 管理员管理所有账单
```sql
CREATE POLICY "Admins can manage all billing records"
ON order_billing
FOR ALL
TO authenticated
USING (...)
WITH CHECK (...);
```

**关键点**：
- ✅ **只有管理员**可以访问 `order_billing` 表
- ❌ **普通用户完全无法访问**该表（包括 SELECT）
- ✅ 这是正确的，因为原始账单数据包含敏感财务信息

---

### system_config 表（2 条策略）

只有管理员可以访问系统配置。

---

## 📊 数据访问流程

### 管理员访问流程

```
1. 管理员登录 Vercel App
   ↓
2. 前端调用 /api/admin/billing/preview
   ↓
3. API 使用 Service Role Key 查询
   ↓
4. Service Role Key 绕过 RLS
   ↓
5. ✅ 返回所有账单数据
```

**API 示例**：
```typescript
// app/api/admin/billing/preview/route.ts
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()  // ← Service Role Key
  
  // 可以查询 order_billing 表
  const { data } = await supabase
    .from('order_billing')
    .select('*')
  
  return Response.json(data)
}
```

---

### 普通用户访问流程

```
1. 普通用户登录 Vercel App
   ↓
2. 前端调用 /api/orders?customerId=xxx
   ↓
3. API 使用 Anon Key 查询 orders 表
   ↓
4. RLS 自动过滤：只返回该用户的订单
   ↓
5. ✅ 返回订单列表（包含显示的账单金额）
```

**API 示例**：
```typescript
// app/(portal)/orders/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function OrdersPage() {
  const supabase = createClient()  // ← Anon Key（遵守 RLS）
  
  // 查询 orders 表（不是 order_billing）
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      cog_usd,        -- ← 来自 View 或计算字段
      shipping_usd,
      fulfillment_usd,
      total_cost_usd
    `)
    // RLS 自动应用：只返回当前用户的订单
  
  return <OrdersTable orders={orders} />
}
```

---

## ❓ 常见问题

### Q1: 普通用户如何看到账单金额？

**A**: 通过 `orders` 表的显示字段：

**方案 1**: 在 `orders` 表中添加显示字段（推荐）
```sql
-- orders 表已有这些字段
SELECT 
    transaction_id,
    cog_usd,        -- 显示值（billed 或 estimated）
    shipping_usd,
    fulfillment_usd,
    total_cost_usd
FROM orders
WHERE store_name IN (
    SELECT store_name FROM customers 
    WHERE auth_user_id = auth.uid()
)
```

**方案 2**: 创建安全的 API 端点
```typescript
// app/api/orders/billing-summary/route.ts
export async function GET(req: Request) {
  const supabase = createClient()  // Anon Key
  
  // 获取当前用户的订单
  const { data: orders } = await supabase
    .from('orders')
    .select('transaction_id, store_name')
  
  // 后端聚合账单数据（不暴露原始表）
  const summary = await calculateBillingSummary(orders)
  
  return Response.json(summary)
}
```

---

### Q2: View 能被子用户访问吗？

**A**: **不能**，因为 View 依赖 `order_billing` 表，而该表对普通用户禁用了 RLS。

```sql
-- 普通用户尝试查询 View
SELECT * FROM orders_with_billing_display;

-- 结果：❌ 权限被拒绝
-- 原因：View 内部引用了 order_billing 表
--       order_billing 的 RLS 阻止了非 admin 用户
```

---

### Q3: 如何让普通用户查看账单摘要？

**A**: 有三种方案：

#### 方案 A: 在 orders 表中冗余显示字段（推荐）

```sql
-- orders 表已经包含这些字段
ALTER TABLE orders ADD COLUMN cog_usd NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN shipping_usd NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN fulfillment_usd NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN total_cost_usd NUMERIC(10,2);

-- 创建触发器同步数据
CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders o
    SET 
        cog_usd = CASE 
            WHEN ob.bill_issued THEN ob.cog_billed_usd
            ELSE ROUND((ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / COALESCE(ob.ex_rate_used, 6.75), 2)
        END,
        shipping_usd = CASE 
            WHEN ob.bill_issued THEN ob.freight_billed_usd
            ELSE ROUND(COALESCE(ob.freight_est_cny, 0) / COALESCE(ob.ex_rate_used, 6.75), 2)
        END,
        fulfillment_usd = ob.fulfillment_usd,
        total_cost_usd = CASE 
            WHEN ob.bill_issued THEN ob.total_cost_usd
            ELSE ROUND(
                ((ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / COALESCE(ob.ex_rate_used, 6.75)) +
                (COALESCE(ob.freight_est_cny, 0) / COALESCE(ob.ex_rate_used, 6.75)) +
                COALESCE(ob.fulfillment_usd, 0),
            2)
        END
    FROM order_billing ob
    WHERE o.transaction_id = ob.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_billing
AFTER INSERT OR UPDATE ON order_billing
FOR EACH ROW
EXECUTE FUNCTION sync_billing_to_orders();
```

**优点**：
- ✅ 简单直接
- ✅ 性能好（无需 JOIN）
- ✅ RLS 自动生效

---

#### 方案 B: 创建安全函数

```sql
-- 创建 SECURITY DEFINER 函数（以 postgres 身份执行）
CREATE OR REPLACE FUNCTION get_user_billing_summary(p_user_id UUID)
RETURNS TABLE (
    transaction_id TEXT,
    cog_usd NUMERIC,
    shipping_usd NUMERIC,
    fulfillment_usd NUMERIC,
    total_cost_usd NUMERIC
) 
SECURITY DEFINER  -- ← 以函数所有者身份执行
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ob.transaction_id,
        CASE 
            WHEN ob.bill_issued THEN ob.cog_billed_usd
            ELSE ROUND((ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / COALESCE(ob.ex_rate_used, 6.75), 2)
        END as cog_usd,
        -- ... 其他字段
    FROM order_billing ob
    JOIN orders o ON ob.transaction_id = o.transaction_id
    JOIN customers c ON o.store_name = c.store_name
    WHERE c.auth_user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 授予执行权限
GRANT EXECUTE ON FUNCTION get_user_billing_summary(UUID) TO authenticated;
```

**调用方式**：
```typescript
const { data } = await supabase
  .rpc('get_user_billing_summary', { p_user_id: userId })
```

**优点**：
- ✅ 精确控制返回数据
- ✅ 可以添加额外逻辑

---

#### 方案 C: API 层聚合

```typescript
// app/api/orders/billing-data/route.ts
export async function GET(req: Request) {
  const supabase = createClient()  // Anon Key
  const { data: { user } } = await supabase.auth.getUser()
  
  // 1. 获取用户的订单
  const { data: orders } = await supabase
    .from('orders')
    .select('transaction_id')
  
  // 2. 后端使用 Service Role Key 查询账单
  const adminSupabase = createServiceClient()
  const { data: billing } = await adminSupabase
    .from('order_billing')
    .select('*')
    .in('transaction_id', orders.map(o => o.transaction_id))
  
  // 3. 聚合并返回（只返回需要的字段）
  const summary = billing.map(b => ({
    transaction_id: b.transaction_id,
    cog_usd: b.bill_issued ? b.cog_billed_usd : calculateEstimated(b),
    // ...
  }))
  
  return Response.json(summary)
}
```

**优点**：
- ✅ 完全控制数据暴露
- ✅ 可以添加缓存、日志等

---

## 📋 实施建议

### 推荐方案：方案 A（orders 表冗余字段）

**理由**：
1. ✅ 最简单，无需额外代码
2. ✅ 性能最好（无 JOIN，无函数调用）
3. ✅ RLS 自动生效
4. ✅ 前端代码无需修改

**实施步骤**：
1. 确认 `orders` 表已有 `cog_usd`, `shipping_usd`, `fulfillment_usd`, `total_cost_usd` 字段
2. 创建触发器同步 `order_billing` → `orders`
3. 前端继续查询 `orders` 表（已有 RLS）

---

## 🔍 验证测试

### 测试 1: 普通用户无法访问 order_billing

```sql
-- 以普通用户身份登录
SET ROLE authenticated;
SET request.jwt.claims.sub = 'user-uuid-here';

-- 尝试查询 order_billing
SELECT COUNT(*) FROM order_billing;

-- 预期：❌ permission denied for table order_billing
```

### 测试 2: 管理员可以访问 order_billing

```sql
-- 以管理员身份登录
SET ROLE authenticated;
SET request.jwt.claims.sub = 'admin-uuid-here';

-- 查询 order_billing
SELECT COUNT(*) FROM order_billing;

-- 预期：✅ 返回记录数
```

### 测试 3: 普通用户可以访问 orders

```sql
-- 以普通用户身份登录
SELECT COUNT(*) FROM orders;

-- 预期：✅ 返回该用户的订单数量（RLS 自动过滤）
```

---

## 💬 总结

### 核心原则

1. **order_billing 表** - 仅管理员可访问（敏感财务数据）
2. **普通用户** - 只能通过 `orders` 表查看显示字段
3. **View** - 继承底层表的 RLS，普通用户无法访问
4. **API 层** - 可以使用 Service Role Key 绕过 RLS（后端安全）

### 数据流

```
普通用户 → Vercel App → API (Anon Key) → orders 表 (RLS 过滤) → 显示账单金额
管理员 → Vercel App → API (Service Key) → order_billing 表 → 完整账单数据
```

### 下一步

选择上述方案之一（推荐方案 A），实现普通用户查看账单摘要的功能。
