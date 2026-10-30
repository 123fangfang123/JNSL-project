# Order Billing 表重构 - 完整实施指南

## 📋 方案确认

根据你的澄清，字段映射关系如下：

| orders 表字段 | order_billing 表字段 | 说明 |
|--------------|---------------------|------|
| `cog_usd` | `cog_billed_usd` | COG 账单美元 |
| `shipping_usd` | `freight_billed_usd` | 运费账单美元 |
| `fulfillment_usd` | `fulfillment_usd` | Fulfillment 美元（保持不变） |
| `billing_date` | `billing_date` | 账单日期 |
| `ex_rate_used` | `ex_rate_used` | 汇率 |
| `total_cost_usd` | `total_billed_usd` | 总账单金额（计算字段） |
| - | `cog_cny` | COG 人民币（新增） |
| - | `cog_premium_cny` | COG 溢价人民币（新增） |
| - | `freight_est_cny` | 估算运费人民币（新增） |
| - | `bill_issued` | 是否已出账（手动设置，boolean） |

### 显示逻辑

**当 `bill_issued = true` 时（已出账）**：
```typescript
cog_usd = cog_billed_usd
shipping_usd = freight_billed_usd
fulfillment_usd = fulfillment_usd
total_cost_usd = order_billing.total_cost_usd  // 直接使用存储的总成本
```

**当 `bill_issued = false` 时（未出账，显示估算价格）**：
```typescript
// 汇率优先级：ex_rate_used > default_exchange_rate (6.75)
effective_ex_rate = COALESCE(ex_rate_used, 6.75)

cog_usd = (cog_cny + cog_premium_cny) / effective_ex_rate
shipping_usd = freight_est_cny / effective_ex_rate
fulfillment_usd = fulfillment_usd
total_cost_usd = cog_usd + shipping_usd + fulfillment_usd
```

**汇率回退机制**：
1. **优先**使用 `order_billing.ex_rate_used`（账单汇率）
2. **其次**使用 `system_config.default_exchange_rate`（配置表中的默认值，初始为 6.75）
3. **然后**使用函数 `get_default_exchange_rate()` 计算的历史平均值（基于 ex_rate_used）
4. **兜底**值为 6.75

**重要说明**：
- ❌ **不使用** `orders.order_ex_rate`，因为它可能不是美元汇率
- ✅ **只使用** `ex_rate_used` 和配置的默认汇率

---

## 🚀 实施步骤

### 阶段 1: 数据库迁移（预计 2-3 小时）

#### 1.1 准备工作

**在开发环境执行**：

```bash
# 1. 备份当前数据库（重要！）
# 通过 Supabase Dashboard 或 CLI 进行完整备份

# 2. 检查现有数据
node check-billing-data.js
```

预期输出：
```
Total orders: 472
With billing_date: 63
Without billing_date: 409
```

#### 1.2 执行迁移脚本

**方法 A: 通过 Supabase SQL Editor**

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 复制 `database-migrations/001_create_order_billing_table.sql` 的全部内容
4. 点击 "Run" 执行
5. 查看输出日志，确认所有步骤成功

**方法 B: 通过 Node.js 脚本**

创建一个执行脚本：

```javascript
// execute-migration.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Executing migration...');
  
  const sql = fs.readFileSync('database-migrations/001_create_order_billing_table.sql', 'utf8');
  
  // 注意：Supabase JS Client 不支持直接执行多语句 SQL
  // 需要通过 REST API 或 psql 命令行工具
  
  console.log('Please execute the SQL via Supabase SQL Editor or psql');
})();
```

**方法 C: 通过 psql 命令行**（推荐）

```bash
# 获取数据库连接信息（从 Supabase Dashboard -> Settings -> Database）
psql -h db.xxx.supabase.co -p 5432 -U postgres -d postgres -f database-migrations/001_create_order_billing_table.sql
```

#### 1.3 验证迁移结果

执行验证查询：

```sql
-- 检查 order_billing 表记录数
SELECT COUNT(*) as total, 
       SUM(CASE WHEN bill_issued THEN 1 ELSE 0 END) as billed,
       SUM(CASE WHEN NOT bill_issued THEN 1 ELSE 0 END) as not_billed
FROM order_billing;

-- 预期输出：
-- total: 472
-- billed: 63
-- not_billed: 409

-- 检查 view 是否正常工作
SELECT transaction_id, order_number, cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, bill_issued
FROM orders_with_billing_display
LIMIT 5;

-- 检查有 billing_date 的记录
SELECT ob.transaction_id, o.billing_date, ob.bill_issued, 
       ob.cog_billed_usd, ob.freight_billed_usd, ob.fulfillment_usd
FROM order_billing ob
JOIN orders o ON ob.transaction_id = o.transaction_id
WHERE ob.bill_issued = true
LIMIT 3;

-- 检查没有 billing_date 的记录
SELECT ob.transaction_id, ob.bill_issued, 
       ob.cog_cny, ob.ex_rate_used,
       ROUND((ob.cog_cny + ob.cog_premium_cny) / ob.ex_rate_used, 2) as estimated_cog_usd
FROM order_billing ob
WHERE ob.bill_issued = false
LIMIT 3;
```

---

### 阶段 2: TypeScript 类型更新（预计 1 小时）

#### 2.1 更新 lib/types.ts

```typescript
// lib/types.ts

export type OrderStatus = 'received' | 'processed' | 'shipped' | 'cancelled' | 'returned'
export type ShipmentStatus = 'created' | 'shipped' | 'cancelled'
export type Carrier = 'YUNExpress' | 'YANWEN' | 'HH EXPRESS' | 'XJ LOGISTICS'
export type AbnormalCode =
  | 'package_lost' | 'customer_request' | 'amend_info' | 'defective' | 'damaged'
  | 'wrong_item' | 'missing_item' | 'change_shipping' | 'shopify_error'

// 新增 OrderBilling 接口
export interface OrderBilling {
  transaction_id: string
  cog_cny: number | null
  cog_premium_cny: number | null
  freight_est_cny: number | null
  cog_billed_usd: number | null
  freight_billed_usd: number | null
  fulfillment_usd: number | null
  ex_rate_used: number | null
  billing_date: string | null
  bill_issued: boolean
}

export interface Order {
  transaction_id: string
  is_abnormal: boolean
  order_number: number
  store_name: string
  order_date: string
  dispatch_date: string | null
  order_status: OrderStatus
  country: string | null
  abnormal_code: AbnormalCode | null
  remarks: string | null
  order_cny_value: number | null
  order_ex_rate: number | null
  
  // Joined from order_shipment
  tracking_no: string | null
  carrier: Carrier | null
  shipment_status: ShipmentStatus | null
  dest_tracking: string | null
  
  // From order_billing (via view)
  billing_date: string | null
  cog_usd: number | null          // Display value (billed or estimated)
  shipping_usd: number | null     // Display value (billed or estimated)
  fulfillment_usd: number | null
  total_cost_usd: number | null   // Calculated: cog_usd + shipping_usd + fulfillment_usd
  ex_rate_used: number | null
  bill_issued: boolean | null
}

// ... 其他类型保持不变
```

---

### 阶段 3: 数据查询层更新（预计 4-6 小时）

#### 3.1 更新 app/(portal)/orders/page.tsx

**当前代码**：
```typescript
let baseQuery = supabase
  .from('orders')
  .select(
    `transaction_id, order_number, store_name, order_date, dispatch_date,
     cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, ex_rate_used,
     order_status, country, billing_date, ...`
  )
```

**修改为**：
```typescript
let baseQuery = supabase
  .from('orders_with_billing_display')  // 使用 view
  .select(
    `transaction_id, order_number, store_name, order_date, dispatch_date,
     cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, ex_rate_used,
     order_status, country, billing_date, bill_issued, ...`
  )
```

或者使用 JOIN：
```typescript
let baseQuery = supabase
  .from('orders')
  .select(`
    transaction_id, order_number, store_name, order_date, dispatch_date,
    order_status, country, abnormal_code, remarks, is_abnormal,
    order_cny_value, order_ex_rate,
    order_billing!inner(
      cog_usd,
      shipping_usd,
      fulfillment_usd,
      total_cost_usd,
      billing_date,
      bill_issued,
      ex_rate_used
    ),
    order_shipment!left(
      tracking_no,
      carrier,
      process_date,
      shipment_status,
      dest_tracking
    )
  `)
```

**关键点**：
- View 会自动处理 `bill_issued` 的逻辑，返回正确的显示值
- 前端代码不需要改变，仍然使用 `cog_usd`, `shipping_usd` 等字段

#### 3.2 更新 app/(portal)/abnormal-orders/page.tsx

同样的修改方式。

#### 3.3 更新 API 导出端点

**app/api/export/route.ts**:
```typescript
// 当前
const { data: rows } = await supabase
  .from('orders')
  .select('..., cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, billing_date, ...')

// 修改为
const { data: rows } = await supabase
  .from('orders_with_billing_display')
  .select('..., cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, billing_date, bill_issued, ...')
```

**app/api/export-abnormal/route.ts**: 同样修改。

#### 3.4 更新 Admin Billing 页面

**app/(admin)/admin/billing/page.tsx**:
```typescript
// 当前
.select('transaction_id, ..., billing_date, cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, ...')

// 修改为
.from('orders_with_billing_display')
.select('transaction_id, ..., billing_date, cog_usd, shipping_usd, fulfillment_usd, total_cost_usd, bill_issued, ...')
```

---

### 阶段 4: UI 组件更新（预计 6-8 小时）

由于我们使用了 View，UI 组件的代码**几乎不需要修改**！

View 已经返回了正确的 `cog_usd`, `shipping_usd`, `total_cost_usd` 值，前端直接使用即可。

**唯一需要添加的功能**：在 Billing 页面添加手动设置 `bill_issued` 的按钮。

#### 4.1 添加 Toggle Bill Issued 功能

在 `components/admin/BillingTable.tsx` 中添加：

```typescript
// 添加 toggle 函数
async function toggleBillIssued(transactionId: string, currentStatus: boolean) {
  const newStatus = !currentStatus
  
  const { error } = await supabase.rpc('update_bill_issued_status', {
    p_transaction_id: transactionId,
    p_bill_issued: newStatus
  })
  
  if (error) {
    alert('Failed to update bill status: ' + error.message)
  } else {
    // Refresh the page or update local state
    window.location.reload()
  }
}

// 在表格中添加操作列
<td className="px-3 py-2 border">
  <button
    onClick={() => toggleBillIssued(order.transaction_id, order.bill_issued)}
    className={`px-2 py-1 rounded text-xs ${
      order.bill_issued 
        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }`}
  >
    {order.bill_issued ? '✓ Billed' : 'Mark as Billed'}
  </button>
</td>
```

---

### 阶段 5: 测试与验证（预计 4-6 小时）

#### 5.1 功能测试清单

- [ ] Orders 页面正常显示
  - [ ] 有 billing_date 的订单显示 billed 价格
  - [ ] 没有 billing_date 的订单显示 estimated 价格
  - [ ] 排序功能正常（按 cog_usd, shipping_usd, total_cost_usd）
  - [ ] 筛选功能正常

- [ ] Abnormal Orders 页面正常显示

- [ ] Excel 导出功能
  - [ ] 导出的数据包含正确的 USD 值
  - [ ] bill_issued 标记正确

- [ ] Admin Billing 页面
  - [ ] 可以查看账单详情
  - [ ] 可以切换 bill_issued 状态
  - [ ] 切换后价格自动更新

- [ ] Dashboard 统计卡片
  - [ ] Total Cost 计算正确

#### 5.2 性能测试

```sql
-- 测试 view 查询性能
EXPLAIN ANALYZE
SELECT * FROM orders_with_billing_display
LIMIT 100;

-- 检查索引使用情况
SELECT * FROM pg_stat_user_indexes
WHERE relname = 'order_billing';
```

---

### 阶段 6: 清理旧字段（确认稳定后执行）

**⚠️ 警告：仅在确认新系统运行稳定至少 1-2 周后执行！**

```sql
-- 删除 orders 表中的旧字段
BEGIN;

ALTER TABLE orders DROP COLUMN IF EXISTS billing_date;
ALTER TABLE orders DROP COLUMN IF EXISTS cog_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS fulfillment_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS total_cost_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS ex_rate_used;

COMMIT;

-- 验证
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;
```

---

## 📊 工作量总结

| 阶段 | 任务 | 预计时间 | 风险等级 |
|------|------|----------|----------|
| 1 | 数据库迁移 | 2-3 小时 | 中 |
| 2 | TypeScript 类型更新 | 1 小时 | 低 |
| 3 | 数据查询层更新 | 4-6 小时 | 高 |
| 4 | UI 组件更新 | 2-3 小时 | 低（因为用了 View） |
| 5 | 测试与验证 | 4-6 小时 | 中 |
| 6 | 清理旧字段 | 0.5 小时 | 低 |
| **总计** | | **13.5-19.5 小时** | |

---

## ⚠️ 关键注意事项

### 1. 数据完整性
- ✅ 迁移脚本包含完整的备份和验证
- ✅ 使用事务确保原子性
- ⚠️ 执行前务必备份数据库

### 2. 向后兼容
- ✅ 使用 View 保持 API 接口不变
- ✅ 前端代码最小化修改
- ⚠️ 需要充分测试所有功能

### 3. 性能考虑
- ✅ 添加了必要的索引
- ⚠️ 需要监控 View 查询性能
- 💡 如果性能不佳，考虑使用 Materialized View

### 4. 业务逻辑
- ✅ `bill_issued` 手动设置，灵活可控
- ✅ 估算价格公式清晰明确
- ⚠️ 需要培训用户如何使用 bill_issued 标记

---

## 🎯 下一步行动

1. **立即执行**：
   - [ ] 在开发环境执行迁移脚本
   - [ ] 验证数据完整性
   - [ ] 测试基本功能

2. **本周内完成**：
   - [ ] 更新 TypeScript 类型
   - [ ] 更新所有查询代码
   - [ ] 添加 bill_issued toggle UI

3. **下周完成**：
   - [ ] 全面测试
   - [ ] 部署到生产环境
   - [ ] 监控运行情况

4. **1-2 周后**：
   - [ ] 确认无问题后删除旧字段

---

## 📞 需要帮助？

如果在实施过程中遇到问题：

1. 检查迁移脚本的输出日志
2. 验证数据库中的记录数是否正确
3. 测试 View 查询是否正常
4. 查看浏览器控制台的错误信息

祝迁移顺利！🚀
