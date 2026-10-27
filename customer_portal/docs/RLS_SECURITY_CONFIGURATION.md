# 行级安全策略 (RLS) 配置说明

## 📅 更新日期
2026-08-10

## ⚠️ 安全问题

你发现的 **"RLS disabled"** 确实是一个**严重的安全问题**！

### 什么是 RLS？

**RLS (Row Level Security)** 是 PostgreSQL 的行级安全策略，用于控制哪些用户可以访问哪些数据行。

### 当前风险 ❌

如果 RLS 未启用：
- ✅ **管理员**可以访问所有数据（正确）
- ❌ **普通用户**也可以访问**所有订单的账单数据**（错误！）
- ❌ 任何有数据库访问权限的用户都可以查看所有客户的敏感财务信息

---

## 🔐 RLS 策略设计

### 核心原则

```
┌─────────────────────────────────────────┐
│         用户角色系统                      │
├─────────────────────────────────────────┤
│                                         │
│  admin (管理员)                         │
│    ↓                                    │
│    ✓ 可以访问 order_billing 表           │
│    ✓ 可以管理所有账单数据                 │
│    ✓ 可以修改系统配置                     │
│                                         │
│  customer (普通用户)                    │
│    ↓                                    │
│    ✗ 不能直接访问 order_billing 表       │
│    ✗ 不能直接查询 View                   │
│    ✓ 只能通过 orders 表查看显示字段      │
│    ✓ 通过 API 间接获取账单摘要           │
│                                         │
└─────────────────────────────────────────┘
```

**重要说明**：
- ❌ **普通用户完全无法访问** `order_billing` 表
- ✅ 普通用户只能通过 `orders` 表的显示字段查看账单金额
- ✅ 这是为了保护敏感的原始账单数据

---

## 🛠️ 实施的 RLS 策略

### 1. order_billing 表

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

**说明**：
- ✅ 允许管理员查询所有订单的账单数据
- ✅ 通过 `user_roles` 表验证用户角色

#### 策略 2: 管理员管理所有账单
```sql
CREATE POLICY "Admins can manage all billing records"
ON order_billing
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);
```

**说明**：
- ✅ 允许管理员 INSERT/UPDATE/DELETE 所有账单数据
- ✅ `USING` 控制读取权限
- ✅ `WITH CHECK` 控制写入权限

**重要**：
- ❌ **没有为普通用户创建任何策略**
- ❌ 普通用户完全无法访问 `order_billing` 表（包括 SELECT）
- ✅ 这是正确的设计，保护敏感财务数据

---

### 2. system_config 表

#### 策略 1: 管理员查看配置
```sql
CREATE POLICY "Admins can view system config"
ON system_config
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

#### 策略 2: 管理员管理配置
```sql
CREATE POLICY "Admins can manage system config"
ON system_config
FOR ALL
TO authenticated
USING (...)
WITH CHECK (...);
```

**说明**：
- ✅ 只有管理员可以查看和修改系统配置
- ✅ 普通用户完全无法访问 `system_config` 表

---

## 📊 权限对比表

| 操作 | 管理员 (admin) | 普通用户 (customer) |
|------|---------------|-------------------|
| **查询 order_billing 表** | ✅ | ❌ **完全禁止** |
| **修改 order_billing 表** | ✅ | ❌ **完全禁止** |
| **查询 orders_with_billing_display View** | ✅ | ❌ **继承 RLS，禁止访问** |
| **查看 orders 表的显示字段** | ✅ | ✅ **通过 RLS 过滤** |
| **查看系统配置** | ✅ | ❌ **完全禁止** |
| **修改默认汇率** | ✅ | ❌ **完全禁止** |

**说明**：
- 普通用户只能通过 `orders` 表的 `cog_usd`, `shipping_usd`, `fulfillment_usd`, `total_cost_usd` 字段查看账单金额
- 这些字段是显示值（billed 或 estimated），由后端同步到 `orders` 表

---

## 🔍 数据访问流程

### 管理员访问流程

```
1. 管理员登录 Vercel App
   ↓
2. 前端调用 /api/admin/billing/*
   ↓
3. API 使用 Service Role Key 查询
   ↓
4. Service Role Key 绕过 RLS
   ↓
5. ✅ 直接查询 order_billing 表
```

### 普通用户访问流程

```
1. 普通用户登录 Vercel App
   ↓
2. 前端调用 /api/orders 或直接查询 orders 表
   ↓
3. API 使用 Anon Key 查询 orders 表
   ↓
4. RLS 自动过滤：只返回该用户的订单
   ↓
5. ✅ 返回 orders 表的显示字段（cog_usd, shipping_usd 等）
```

**重要说明**：
- ❌ 普通用户**不能**直接查询 `order_billing` 表
- ❌ 普通用户**不能**查询 `orders_with_billing_display` View
- ✅ 普通用户只能查询 `orders` 表，通过显示字段查看账单金额

---

## ⚙️ 如何执行更新后的脚本

### 方法 1: Supabase SQL Editor（推荐）

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入项目 → **SQL Editor**
3. 打开 `database-migrations/001_create_order_billing_table.sql`
4. 点击 **Run** 执行
5. 查看输出确认 RLS 已启用

**预期输出**：
```
✓ order_billing table created successfully
✓ system_config table created successfully
✓ Helper functions created successfully
✓ View orders_with_billing_display created successfully
All validation checks passed!
✓ Row Level Security policies configured successfully
```

### 方法 2: 单独执行 RLS 策略

如果表已经创建，只需执行 RLS 部分：

```sql
-- 启用 RLS
ALTER TABLE order_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 创建策略（复制脚本中的 CREATE POLICY 语句）
...

-- 验证
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('order_billing', 'system_config');
```

---

## ✅ 验证 RLS 是否生效

### 测试 1: 检查 RLS 状态

```sql
SELECT 
    relname AS table_name,
    relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('order_billing', 'system_config');
```

**预期结果**：
```
table_name      | rls_enabled
----------------+-------------
order_billing   | true        ← 必须是 true
system_config   | true        ← 必须是 true
```

### 测试 2: 查看已创建的策略

```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('order_billing', 'system_config')
ORDER BY tablename, policyname;
```

**预期结果**：
```
tablename       | policyname                              | cmd    | roles
----------------+----------------------------------------+--------+-----------
order_billing   | Admins can manage all billing records  | ALL    | {authenticated}
order_billing   | Admins can view all billing records    | SELECT | {authenticated}
order_billing   | Users can view their own billing rec.. | SELECT | {authenticated}
system_config   | Admins can manage system config        | ALL    | {authenticated}
system_config   | Admins can view system config          | SELECT | {authenticated}
```

### 测试 3: 普通用户无法访问 order_billing

```sql
-- 以普通用户身份登录（非 admin 角色）
SET ROLE authenticated;
SET request.jwt.claims.sub = 'customer-user-uuid';

-- 尝试查询 order_billing
SELECT COUNT(*) FROM order_billing;

-- 预期：❌ permission denied for table order_billing
```

### 测试 4: 普通用户可以访问 orders

```sql
-- 以普通用户身份登录
SELECT COUNT(*) FROM orders;

-- 预期：✅ 返回该用户的订单数量（RLS 自动过滤）
-- 注意：orders 表应该有基于 store_name 的 RLS 策略
```

---

## 🔧 常见问题

### Q1: 为什么需要 RLS？

**A**: RLS 是多租户应用的核心安全机制。没有 RLS：
- ❌ 普通用户可以查看所有客户的财务数据
- ❌ 违反数据隐私法规（如 GDPR、CCPA）
- ❌ 存在严重的数据泄露风险

### Q2: RLS 会影响性能吗？

**A**: 
- ✅ RLS 的性能影响很小（通常 < 5%）
- ✅ PostgreSQL 会自动优化 RLS 策略
- ✅ 可以通过索引进一步优化（已有 `idx_order_billing_transaction_id`）

### Q3: 如果我想让普通用户也能修改自己的账单怎么办？

**A**: 添加一个新的策略：

```sql
CREATE POLICY "Users can update their own billing records"
ON order_billing
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM orders o
        JOIN customers c ON o.store_name = c.store_name
        WHERE o.transaction_id = order_billing.transaction_id
        AND c.auth_user_id = auth.uid()
    )
)
WITH CHECK (
    -- 限制只能修改特定字段
    NEW.bill_issued = OLD.bill_issued  -- 不允许修改 bill_issued
);
```

### Q4: 如何临时禁用 RLS 进行测试？

**A**: 

```sql
-- ⚠️ 仅用于测试环境，生产环境严禁使用
ALTER TABLE order_billing DISABLE ROW LEVEL SECURITY;

-- 测试完成后立即重新启用
ALTER TABLE order_billing ENABLE ROW LEVEL SECURITY;
```

### Q5: Service Role Key 会绕过 RLS 吗？

**A**: 
- ✅ **是的**，Service Role Key 会绕过所有 RLS 策略
- ✅ 这是设计行为，用于后端服务访问
- ✅ 前端必须使用 **Anon Key**，它会遵守 RLS

---

## 📋 安全检查清单

部署前请确认：

- [ ] RLS 已在 `order_billing` 表上启用
- [ ] RLS 已在 `system_config` 表上启用
- [ ] 管理员策略已创建（3 条）
- [ ] 普通用户策略已创建（1 条）
- [ ] 使用 Anon Key 的前端请求会遵守 RLS
- [ ] 使用 Service Role Key 的后端请求可以正常访问
- [ ] 已测试普通用户无法访问其他客户的数据
- [ ] 已测试管理员可以访问所有数据

---

## 🔗 相关文档

- [PostgreSQL RLS 官方文档](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS 指南](https://supabase.com/docs/guides/auth/row-level-security)
- [BILLING_VIEW_LOGIC_EXPLANATION.md](./BILLING_VIEW_LOGIC_EXPLANATION.md) - View 计算逻辑
- [MIGRATION_REMOVAL_20260810.md](./MIGRATION_REMOVAL_20260810.md) - 迁移脚本说明

---

## 💬 总结

### 核心要点

1. **order_billing 表** - 仅管理员可访问（敏感财务数据）
2. **普通用户** - 完全无法访问 order_billing 表，只能通过 orders 表的显示字段查看账单金额
3. **View** - 继承底层表的 RLS，普通用户无法访问
4. **最小权限原则** - 用户只能访问必要的数据
5. **自动验证** - 脚本包含 RLS 验证逻辑

### 安全性提升

| 方面 | RLS 启用前 | RLS 启用后 |
|------|-----------|-----------|
| 数据隔离 | ❌ 无 | ✅ 完整隔离 |
| 隐私保护 | ❌ 可查看所有数据 | ✅ 只能看自己的订单 |
| 合规性 | ❌ 不合规 | ✅ 符合 GDPR/CCPA |
| 风险评估 | 🔴 高风险 | 🟢 低风险 |
| order_billing 访问控制 | ❌ 所有人都能访问 | ✅ 仅管理员可访问 |

**强烈建议立即执行更新后的脚本以启用 RLS！**
