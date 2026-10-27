# 客户门户订单列表更新说明（修正版）

## 📋 更新内容

### 1. 添加 `total_cost_usd` 字段显示

**修改文件：**
- ✅ `app/(portal)/orders/page.tsx` - 查询时包含 `total_cost_usd` 字段
- ✅ `lib/types.ts` - Order 接口已包含该字段
- ✅ `components/OrderRow.tsx` - 优先使用存储的 `total_cost_usd`，为空时实时计算
- ✅ `components/OrdersTable.tsx` - 排序和汇总计算使用 `total_cost_usd`
- ✅ `app/api/export/route.ts` - 导出时包含 `total_cost_usd`
- ✅ `app/api/export-abnormal/route.ts` - 异常订单导出包含 `total_cost_usd`

**向后兼容性：**
```typescript
// 如果 total_cost_usd 为 NULL，自动回退到实时计算
const total = order.total_cost_usd ?? (
  (order.cog_usd ?? 0) + 
  (order.shipping_usd ?? 0) + 
  (order.fulfillment_usd ?? 0)
)
```

---

### 2. 按订单号（order_number）分组显示

#### **业务场景说明**

一个 **订单号（order_number）** 可能对应多个 **交易号（transaction_id）**，例如：
- 一个订单分批发货，产生多个物流追踪号
- 一个订单拆分成多个包裹处理
- 每个 transaction_id 代表一次独立的物流操作

**关系模型：**
```
Order Number #1001
├─ Transaction ID: TXN-ABC (Tracking: YX123)
├─ Transaction ID: TXN-DEF (Tracking: YX456)
└─ Transaction ID: TXN-GHI (Tracking: YX789)
```

#### **UI方案：按订单号分组折叠显示**

**默认排序：**
- 按 `order_number` 升序排列

**分组逻辑：**
- 相同 `order_number` 的订单归为一组
- 每组可能包含 1 个或多个 `transaction_id`

**UI表现：**

1. **单个交易号的订单号**
   - 直接平铺显示，与普通订单无异
   - 可展开查看订单项详情（SKU、数量等）

2. **多个交易号的订单号**
   - **主行（Group Header）**：
     - 显示：订单号 + 交易数量 + 汇总总成本
     - 左侧有展开/折叠箭头（▶/▼）
     - 背景色：浅紫色（indigo-50）表示分组
     - 状态标签："Group"（紫色徽章）
   
   - **子交易（Child Transactions）**：
     - 点击主行后展开显示所有交易号
     - 每个交易号完整显示所有字段（包括各自的 tracking_no）
     - 背景色：浅灰色（gray-50）区分层级
     - 无展开箭头（避免混淆）

**视觉层次：**
```
┌──────────────────────────────────────────────────────┐
│ ▶ Order #1001 (3 transactions)    $150.00  [Group]  │ ← 主行（可点击）
└──────────────────────────────────────────────────────┘
  ▼ Order #1001 (展开后)
  ├─ TXN-ABC | Tracking: YX123 | $50.00  | shipped    │ ← 交易1
  ├─ TXN-DEF | Tracking: YX456 | $60.00  | shipped    │ ← 交易2
  └─ TXN-GHI | Tracking: YX789 | $40.00  | processed  │ ← 交易3

┌──────────────────────────────────────────────────────┐
│ Order #1002 | TXN-JKL | Tracking: YX999 | $75.00    │ ← 单交易（正常显示）
└──────────────────────────────────────────────────────┘
```

---

## 🔧 技术实现细节

### 数据结构

```typescript
type OrderGroup = {
  order_number: number      // 订单号（分组键）
  orders: Order[]           // 该订单号下的所有交易
  totalCount: number        // 交易数量
  totalCost: number         // 总成本汇总
}
```

### 分组逻辑

```typescript
const groupedOrders = useMemo(() => {
  const groups = new Map<number, OrderGroup>()
  for (const order of sorted) {
    const orderNum = order.order_number
    if (!groups.has(orderNum)) {
      groups.set(orderNum, {
        order_number: orderNum,
        orders: [],
        totalCount: 0,
        totalCost: 0,
      })
    }
    const group = groups.get(orderNum)!
    group.orders.push(order)
    group.totalCount++
    group.totalCost += order.total_cost_usd ?? calculatedTotal
  }
  return Array.from(groups.values())
}, [sorted])
```

### 渲染逻辑

```typescript
{groupedOrders.map(group => {
  const groupKey = String(group.order_number)
  const isExpanded = expandedGroups.has(groupKey)
  const hasMultiple = group.orders.length > 1
  
  if (!hasMultiple) {
    // 单个交易：正常渲染
    return <OrderRow key={`order-${group.order_number}`} order={group.orders[0]} />
  }
  
  // 多个交易：分组渲染
  return (
    <>
      {/* 主行 */}
      <tr onClick={() => toggleGroup(group.order_number)}>
        <td>{isExpanded ? '▼' : '▶'}</td>
        <td colSpan={2}>
          Order #{group.order_number} ({group.totalCount} transactions)
        </td>
        <td colSpan={3}>${group.totalCost.toFixed(2)}</td>
        <td><span className="bg-indigo-100">Group</span></td>
      </tr>
      
      {/* 子交易 */}
      {isExpanded && group.orders.map((order, idx) => (
        <OrderRow key={`${order.transaction_id}-${idx}`} order={order} isChild />
      ))}
    </>
  )
})}
```

---

## 🎯 用户体验优势

1. **符合业务逻辑**
   - 以订单号为主要组织维度，更符合用户思维
   - 清晰展示一个订单的多个物流批次

2. **减少视觉混乱**
   - 默认折叠多交易组，避免表格过长
   - 需要时才展开查看各交易详情

3. **快速汇总查看**
   - 主行显示订单总成本，无需手动加总
   - 交易数量一目了然

4. **保持原有功能**
   - 单交易订单行为不受影响
   - 仍可展开查看订单项详情（SKU、数量等）
   - 排序、筛选、导出功能正常工作

---

## 📊 数据流

```
数据库查询 (按 order_number 排序)
    ↓
前端接收 Order[] 数组
    ↓
按 order_number 分组 → OrderGroup[]
    ↓
渲染表格
  ├─ 单交易组 → 直接渲染 OrderRow
  └─ 多交易组 → 渲染 Group Header + 展开的 OrderRow[]
```

---

## ⚠️ 注意事项

1. **性能考虑**
   - 使用 `useMemo` 缓存分组结果，避免重复计算
   - 分组在客户端完成，不影响服务器查询性能

2. **排序兼容性**
   - 用户仍可按其他列排序（如日期、金额）
   - 排序后重新分组，保持逻辑一致性

3. **样式区分**
   - 主行：indigo-50 背景 + indigo-700 文字
   - 子交易：gray-50 背景
   - 普通订单：白色背景

4. **关键差异**
   - **之前错误**：按 transaction_id 分组（每个交易号唯一，无法分组）
   - **正确做法**：按 order_number 分组（一个订单号可有多个交易号）

---

## 🚀 测试建议

1. **单交易场景**
   - 验证显示与普通订单一致
   - 展开功能正常工作（查看 SKU 等）

2. **多交易场景**
   - 验证主行正确显示交易数量和总成本
   - 展开/折叠切换流畅
   - 每个子交易显示各自的 tracking_no 和其他字段

3. **排序测试**
   - 按不同列排序后，分组仍然正确
   - 总成本计算准确

4. **边界情况**
   - 空订单列表
   - 所有订单都是单交易组
   - 所有订单都属于同一订单号

---

## 📝 后续优化建议

1. **批量操作**
   - 在主行添加"导出此订单"按钮
   - 支持批量标记状态

2. **统计信息**
   - 在主行显示最早/最晚发货日期
   - 显示涉及的不同承运商

3. **搜索增强**
   - 支持按订单号搜索
   - 高亮匹配的组

4. **移动端适配**
   - 小屏幕下简化主行显示
   - 横向滚动优化
