# Freight 表结构变更：移除 premium 字段，添加 duty 字段

**变更日期**：2026-10-21  
**变更原因**：业务需求调整，将"附加费"改为"关税"

---

## 变更内容

### 1. 数据库表结构

**变更前**：
```sql
freight 表字段：
- tracking_no (PK)
- billing_date
- weight_g
- freight
- premium  ← 移除
```

**变更后**：
```sql
freight 表字段：
- tracking_no (PK)
- billing_date
- weight_g
- freight
- duty  ← 新增（关税）
```

### 2. 迁移脚本

**文件位置**：`customer_portal/database-migrations/004_freight_replace_premium_with_duty.sql`

**执行方式**：
```bash
# 在 Supabase SQL Editor 中执行，或使用 supabase CLI
supabase db push
```

---

## 代码修改清单

### ✅ 已修改文件

1. **API 路由**
   - `customer_portal/source/app/api/admin/upload/freight/route.ts`
     - 移除：`freightRow.premium = null`
     - 新增：`freightRow.duty = row.duty != null ? (parseFloat(String(row.duty)) || null) : null`
   
   - `customer_portal/source/app/api/admin/billing/preview/route.ts`
     - 修改：`.select('tracking_no, freight, premium')` → `.select('tracking_no, freight, duty')`
     - 修改：`Number(fr.premium ?? 0)` → `Number(fr.duty ?? 0)`

2. **列映射配置**
   - `customer_portal/source/lib/admin/column-maps/freight.ts`
     - 修改：`'附加费': 'premium'` → `'关税': 'duty'`

3. **前端组件**
   - `customer_portal/source/components/admin/FreightDuplicateResolver.tsx`
     - 新增：`<Field label="Duty" value={row.duty != null ? \`¥${row.duty}\` : null} />`

### ⚠️ 未修改文件（无需修改）

- `freight-yanwen.ts` - 原本就没有 premium 字段映射
- `freight-yunexpress.ts` - 原本就没有 premium 字段映射
- `freight-import-config.js` - 只有占位符注释，无实际映射
- `import-freight-bill.js` - CLI 工具中没有 premium 引用

---

## 计费逻辑影响

### 变更前
```typescript
// billing preview 计算运费总额
const total = Number(fr.freight ?? 0) + Number(fr.premium ?? 0)
```

### 变更后
```typescript
// billing preview 计算运费总额
const total = Number(fr.freight ?? 0) + Number(fr.duty ?? 0)
```

**说明**：
- `freight` 字段：运费金额
- `duty` 字段：关税金额（替代原来的附加费）
- 计费时会将运费和关税相加得到总运费成本

---

## 前端导入界面

**路径**：`/admin/upload/freight`

**支持的物流商**：
- YUNExpress（云途）
- YANWEN（燕文）

**Excel 列映射**（通用配置 `freight.ts`）：
| Excel 列名 | 数据库字段 |
|-----------|-----------|
| 追踪号 | tracking_no |
| 账单日期 | billing_date |
| 重量(g) | weight_g |
| 运费 | freight |
| 关税 | duty ← 原为"附加费" |

**注意**：各物流商的独立列映射文件（freight-yanwen.ts, freight-yunexpress.ts）中暂未添加 duty 字段映射，待实际拿到包含关税列的 Excel 文件后再配置。

---

## 测试检查清单

- [ ] 执行数据库迁移脚本
- [ ] 验证 freight 表结构（premium 已删除，duty 已添加）
- [ ] 测试前端上传功能（/admin/upload/freight）
- [ ] 测试计费预览功能（确认 duty 字段正确计算）
- [ ] 测试重复记录处理（确认 Duty 字段正确显示）
- [ ] 导入包含"关税"列的 Excel 文件测试

---

## 回滚方案

如需回滚，执行以下 SQL：
```sql
-- 恢复 premium 字段
ALTER TABLE freight ADD COLUMN IF NOT EXISTS premium NUMERIC;

-- 删除 duty 字段
ALTER TABLE freight DROP COLUMN IF EXISTS duty;

-- 恢复代码（使用 git revert）
git revert <commit-hash>
```

---

## 相关文件位置

- 迁移脚本：`customer_portal/database-migrations/004_freight_replace_premium_with_duty.sql`
- API 路由：`customer_portal/source/app/api/admin/upload/freight/route.ts`
- 计费预览：`customer_portal/source/app/api/admin/billing/preview/route.ts`
- 列映射：`customer_portal/source/lib/admin/column-maps/freight.ts`
- 前端组件：`customer_portal/source/components/admin/FreightDuplicateResolver.tsx`
- 前端页面：`customer_portal/source/app/(admin)/admin/upload/freight/page.tsx`
