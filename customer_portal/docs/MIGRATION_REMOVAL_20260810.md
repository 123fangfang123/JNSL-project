# 移除数据迁移模块说明

## 📅 更新日期
2026-08-10

## 🎯 变更目标

从 `001_create_order_billing_table.sql` 脚本中**移除数据迁移模块**，因为用户将手动导入已出账订单数据。

---

## 🔄 变更前后对比

### 变更前（包含数据迁移）❌

```sql
-- 步骤 1: 创建 order_billing 表
CREATE TABLE order_billing (...);

-- 步骤 2: 迁移现有数据到 order_billing  ← 已删除
INSERT INTO order_billing (...) SELECT ... FROM orders WHERE billing_date IS NOT NULL;
INSERT INTO order_billing (...) SELECT ... FROM orders WHERE billing_date IS NULL;

-- 验证迁移
DO $$ ... END $$;

-- 步骤 3: 创建辅助函数和配置表
CREATE FUNCTION get_default_exchange_rate() ...;

-- 步骤 4: 创建 View
CREATE VIEW orders_with_billing_display ...;

-- 步骤 5: 验证数据完整性
DO $$ ... END $$;
```

### 变更后（仅创建结构）✅

```sql
-- 步骤 1: 创建 order_billing 表
CREATE TABLE order_billing (...);

-- 步骤 2: 创建辅助函数和配置表
CREATE FUNCTION get_default_exchange_rate() ...;
CREATE TABLE system_config (...);
CREATE FUNCTION update_bill_issued_status() ...;
CREATE FUNCTION batch_update_bill_issued() ...;

-- 步骤 3: 创建 View
CREATE VIEW orders_with_billing_display ...;

-- 步骤 4: 验证表结构和函数
DO $$ ... END $$;
```

---

## 🛠️ 修改内容

### 1. 删除的内容

**完全删除的步骤 2**（约 100 行代码）：
- ❌ `2.1 迁移有 billing_date 的记录（bill_issued = true）`
- ❌ `2.2 迁移没有 billing_date 的记录（bill_issued = false）`
- ❌ `验证迁移的 DO 块`

**删除的代码量**：
- INSERT INTO ... SELECT 语句：~70 行
- 验证逻辑：~30 行
- **总计**：~100 行

### 2. 更新的步骤编号

| 原编号 | 新编号 | 内容 |
|--------|--------|------|
| 步骤 1 | 步骤 1 | 创建 order_billing 表 ✅ 不变 |
| 步骤 2 | **已删除** | ~~迁移现有数据~~ ❌ |
| 步骤 3 | **步骤 2** | 创建辅助函数和配置表 ⬆️ |
| 步骤 4 | **步骤 3** | 创建 View ⬆️ |
| 步骤 5 | **步骤 4** | 验证表结构和函数 ⬆️ |

### 3. 更新验证逻辑

**之前的验证**（检查数据迁移结果）：
```sql
-- 检查所有 orders 都有对应的 order_billing 记录
SELECT COUNT(*) FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id
WHERE ob.transaction_id IS NULL;

-- 检查 bill_issued=true 的记录都有 billed USD 值
SELECT COUNT(*) FROM order_billing
WHERE bill_issued = true 
  AND (cog_billed_usd IS NULL OR freight_billed_usd IS NULL);
```

**现在的验证**（检查表结构）：
```sql
-- 检查 order_billing 表是否存在
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'order_billing';

-- 检查 system_config 表是否存在
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'system_config';

-- 检查 get_default_exchange_rate 函数是否存在
SELECT COUNT(*) FROM pg_proc 
WHERE proname = 'get_default_exchange_rate';

-- 检查 View 是否可以正常查询
PERFORM * FROM orders_with_billing_display LIMIT 1;
```

---

## 📊 影响分析

### 优点 ✅

1. **更简洁的脚本** - 减少约 100 行代码
2. **更清晰的职责** - 脚本只负责创建结构，不负责数据
3. **更灵活的部署** - 可以根据实际需求分批导入数据
4. **避免数据错误** - 不会因为自动迁移逻辑导致数据不准确

### 注意事项 ⚠️

1. **需要手动导入数据** - 用户需要通过其他方式导入已出账订单数据
2. **初始状态为空表** - 执行脚本后，`order_billing` 表是空的
3. **View 不会返回数据** - 直到手动导入数据后，View 才会有结果

---

## 💡 手动导入数据指南

### 方法 1: 使用 SQL INSERT 语句

```sql
-- 导入单个已出账订单
INSERT INTO order_billing (
    transaction_id,
    cog_cny,
    cog_premium_cny,
    freight_est_cny,
    cog_billed_usd,
    freight_billed_usd,
    fulfillment_usd,
    total_cost_usd,  -- ✅ 必须计算并存储
    ex_rate_used,
    billing_date,
    bill_issued
) VALUES (
    'TXN001',
    675.00,           -- COG 人民币
    0,                -- 溢价
    NULL,             -- 估算运费（已出账不需要）
    100.00,           -- COG 美元
    20.00,            -- 运费美元
    5.00,             -- Fulfillment 美元
    125.00,           -- ✅ 总成本 = 100 + 20 + 5
    6.75,             -- 汇率
    '2026-08-10',     -- 账单日期
    true              -- 已出账
);
```

### 方法 2: 批量导入（从 CSV/Excel）

```sql
-- 使用 COPY 命令从 CSV 文件导入
COPY order_billing (
    transaction_id,
    cog_cny,
    cog_premium_cny,
    freight_est_cny,
    cog_billed_usd,
    freight_billed_usd,
    fulfillment_usd,
    total_cost_usd,
    ex_rate_used,
    billing_date,
    bill_issued
) FROM '/path/to/billing_data.csv'
WITH (FORMAT csv, HEADER true);
```

### 方法 3: 通过 API 导入

```typescript
// 在应用中创建导入接口
async function importBillingData(billingRecords: BillingRecord[]) {
  for (const record of billingRecords) {
    // 计算总成本
    const totalCostUsd = 
      record.cog_billed_usd + 
      record.freight_billed_usd + 
      record.fulfillment_usd;
    
    await supabase.from('order_billing').insert({
      ...record,
      total_cost_usd: totalCostUsd,  // ✅ 必须设置
      bill_issued: true,
    });
  }
}
```

---

## 📝 修改的文件

### database-migrations/001_create_order_billing_table.sql

**修改摘要**：
- ✅ 删除整个"步骤 2: 迁移现有数据"部分（~100 行）
- ✅ 更新步骤编号（3→2, 4→3, 5→4）
- ✅ 简化验证逻辑（从数据验证改为结构验证）
- ✅ 保持表结构、函数、View 定义不变

**最终脚本结构**：
```
步骤 0: 备份现有数据（可选）
步骤 1: 创建 order_billing 表（含 total_cost_usd 字段）
步骤 2: 创建辅助函数和配置表
  - get_default_exchange_rate()
  - system_config 表
  - update_bill_issued_status()
  - batch_update_bill_issued()
步骤 3: 创建 View orders_with_billing_display
步骤 4: 验证表结构和函数
```

---

## ✅ 验证测试

### 测试 1: 执行脚本

```bash
# 在 Supabase SQL Editor 中执行脚本
# 预期输出：
# ✓ order_billing table created successfully
# ✓ system_config table created successfully
# ✓ Helper functions created successfully
# ✓ View orders_with_billing_display created successfully
# All validation checks passed!
```

### 测试 2: 检查表是否为空

```sql
SELECT COUNT(*) FROM order_billing;
-- 预期结果：0（空表）
```

### 测试 3: 手动插入测试数据

```sql
INSERT INTO order_billing (
    transaction_id,
    cog_billed_usd,
    freight_billed_usd,
    fulfillment_usd,
    total_cost_usd,
    ex_rate_used,
    billing_date,
    bill_issued
) VALUES (
    'TEST001',
    100.00,
    20.00,
    5.00,
    125.00,  -- 100 + 20 + 5
    6.75,
    '2026-08-10',
    true
);

-- 验证 View
SELECT * FROM orders_with_billing_display 
WHERE transaction_id = 'TEST001';
-- 预期：total_cost_usd = 125.00
```

---

## 📋 后续操作清单

执行脚本后，需要完成以下操作：

- [ ] 准备已出账订单的 billing 数据
- [ ] 计算每个订单的 `total_cost_usd`（cog_billed_usd + freight_billed_usd + fulfillment_usd）
- [ ] 通过 SQL/API/CSV 导入数据到 `order_billing` 表
- [ ] 验证导入的数据是否正确
- [ ] 测试 View 是否能正确显示数据
- [ ] 更新前端代码以使用新的 View

---

## 🔗 相关文档

- [BILLING_VIEW_LOGIC_EXPLANATION.md](./BILLING_VIEW_LOGIC_EXPLANATION.md) - View 计算逻辑详解
- [TOTAL_COST_UPDATE_20260810.md](./TOTAL_COST_UPDATE_20260810.md) - Total Cost USD 字段说明
- [DEFAULT_EXCHANGE_RATE_MECHANISM.md](./DEFAULT_EXCHANGE_RATE_MECHANISM.md) - 默认汇率机制
- [order-billing-implementation-guide.md](./order-billing-implementation-guide.md) - 完整实施指南

---

## 💬 总结

**核心变更**：
- ✅ 移除了自动数据迁移逻辑（~100 行代码）
- ✅ 脚本现在只负责创建数据库结构
- ✅ 用户可以灵活地手动导入数据
- ✅ 避免了自动迁移可能带来的数据错误

**优势**：
- 更简洁、更清晰、更灵活
- 用户可以控制数据导入的时机和方式
- 减少了脚本的复杂性和潜在风险
