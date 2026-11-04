# GC 物流（易可达）运费导入工作流文档

**版本**: 1.0  
**创建日期**: 2026-11-04  
**最后更新**: 2026-11-04  
**状态**: ✅ 已创建

---

## 📋 工作流概述

本工作流用于从 GC 物流（易可达）系统导出的 Excel 文件中批量导入运费数据到 `freight` 表。

### **核心特性**
- **自动识别 GC 物流商**（基于 Excel 表头关键字：出库时间、GC、易可达）
- **运费乘数转换**：文件中的运费为美元，需 × 6.7 转换为人民币后写入数据库
- **重量单位转换**：文件中的计费重量为 kg，需 × 1000 转换为 g 后写入数据库
- **文件内去重**：同一运单号多条记录时，费用列相加合并为一条
- **三路分支写入**：不存在→插入，freight 相同→跳过，freight 不同→费用相加后更新
- **其他费用字段留空**：freight_fee、registered_fee、other_fee 均写入 null

---

## 🎯 输入要求

### **Excel 文件格式**
- **文件类型**: `.xlsx` / `.xls`
- **必需列**:
  - `客户单号` - 运单号（主匹配键）
  - `总费用` - 运费金额（美元）
- **可选列**:
  - `出库时间` - 账单日期
  - `计费重量（KG）` - 计费重量

### **实际文件表头示例**
```
订单参考号, 订单状态, 创建时间, 出库时间, 跟踪号, 实际送达时间, 总费用, 订单总体积（CM³）, 实际重量（KG）, 计费重量（KG）
```

---

## 📊 字段映射（Excel → freight 表）

### **GC 物流（易可达）**

| 导入文件字段 | 说明 | 数据库字段 | 转换规则 |
|-------------|------|-----------|---------|
| 跟踪号 | 运单号 | tracking_no | 直接映射 |
| 出库时间 | 结算日期 | billing_date | 日期格式转换 |
| 计费重量（KG） | 计费重量 | weight_g | kg → g（×1000） |
| 总费用 | 运费 | freight | USD → CNY（×6.7） |
| — | 基础运费 | freight_fee | 留空（null） |
| — | 挂号费 | registered_fee | 留空（null） |
| — | 其他费用 | other_fee | 留空（null） |

### **特殊转换说明**

#### 1. 运费乘数转换
GC 物流的运费文件以**美元（USD）**计价，需要乘以汇率 **6.7** 转换为人民币后写入数据库。

**转换公式**：
```javascript
freight (CNY) = 总费用 (USD) × 6.7
```

**示例**：
- 文件中总费用 = 10.50 USD
- 数据库写入 freight = 10.50 × 6.7 = 70.35 CNY

#### 2. 重量单位转换
GC 物流的计费重量以**千克（kg）**为单位，数据库存储以**克（g）**为单位。

**转换公式**：
```javascript
weight_g = 计费重量（KG） × 1000
```

**示例**：
- 文件中计费重量 = 2.5 KG
- 数据库写入 weight_g = 2.5 × 1000 = 2500 g

#### 3. 费用字段留空
GC 物流不提供费用拆分（freight_fee、registered_fee、other_fee），这些字段均写入 **null**。

---

## 🔄 工作流程

### **步骤1: 读取 Excel 文件**
- 检查文件是否存在
- 解析第一个工作表
- 提取表头和数据行
- 统计记录数和列数

**输出示例**:
```
📖 步骤1: 读取 Excel 文件...
   文件: GC订单及运费.xlsx
   总记录数: 500
   列数: 4
   ✅ 列名验证通过
```

### **步骤2: 识别物流商并确认映射关系**
- 扫描 Excel 表头
- 匹配配置文件中的关键字（出库时间、GC、易可达）
- 确定物流商名称为 `GC`
- 显示当前配置的列映射，等待用户确认

**输出示例**:
```
🔍 步骤2: 识别物流商...
   ✅ 识别为: GC 物流（易可达）

📋 当前配置的列映射:
   ✅ tracking_no ← 客户单号
   ✅ billing_date ← 出库时间
   ✅ weight_g ← 计费重量（KG）
   ✅ freight ← 总费用

⏸️  请确认以上映射关系是否正确？
```

### **步骤3: 解析运费数据 + 文件内去重**
- 根据列映射提取数据
- **应用运费乘数**：freight = 总费用 × 6.7
- **重量单位转换**：weight_g = 计费重量（KG）× 1000
- **设置其他费用字段为 null**：freight_fee、registered_fee、other_fee
- 验证必需字段（tracking_no, freight）
- 过滤无效记录
- **文件内去重**：同一运单号多条记录时，费用列相加合并

**输出示例**:
```
🔄 步骤3: 解析运费数据...
   💱 运费乘数: 10.50 × 6.7 = 70.35
   💱 运费乘数: 8.20 × 6.7 = 54.94
   ...
   🔗 合并重复运单: GC123456789 (第 1 条重复)
   ✅ 解析完成: 500 条记录（合并 5 条重复）
```

### **步骤4: 写入 freight 表（比较 + 插入/跳过/更新）**
- **批量查询**已存在的 tracking_no 及其费用字段
- **三条分支逻辑**：
  - **不存在** → 插入新记录
  - **存在且 freight 相同** → 跳过，记录日志
  - **存在且 freight 不同** → 将所有费用列相加后更新
- 报告输出新增、跳过、更新、错误的数量

**输出示例**:
```
💾 步骤4: 写入 freight 表...
   ✅ 新增: 450 条
   ⏭️  跳过: 30 条（freight 相同）
   🔄 更新: 20 条（freight 不同，费用相加）
   ❌ 错误: 0 条
```

### **步骤5: 生成执行报告**
- 统计各项数量
- 输出执行摘要
- 提供操作建议

**输出示例**:
```
========== 执行报告 ==========
总记录数: 500
  - 新增: 450
  - 跳过: 30
  - 更新: 20
  - 错误: 0
================================

✅ GC 运费导入完成！
```

### **步骤6: 保存运行日志**
- 将完整执行过程保存到 `Data Import/Process log` 文件夹
- 日志文件名格式：`GC_Freight_{TIMESTAMP}.log`
- 包含时间戳、操作步骤、统计结果

---

## 🔧 配置文件说明

### **配置文件位置**
```
source/lib/admin/carrier-configs/freight-bill-config.js
tools/lib/admin/carrier-configs/freight-bill-config.js  （镜像）
```

### **GC 相关配置**

#### 1. 物流商标识符（CARRIER_IDENTIFIERS）
```javascript
// GC 物流（易可达）- 运费文件独有列名
'出库时间': 'GC',
'GC':       'GC',
'易可达':   'GC'
```

#### 2. 列映射（CARRIER_COLUMN_MAPS）
```javascript
'GC': {
  '跟踪号': 'tracking_no',
  '出库时间': 'billing_date',
  '计费重量（KG）': 'weight_g',
  '总费用': 'freight'
  // freight_fee / registered_fee / other_fee 均留空
  // freight 需要 × 6.7 转换为人民币
}
```

#### 3. 重量单位配置（WEIGHT_UNIT）
```javascript
WEIGHT_UNIT: {
  'GC': 'kg'  // 文件中单位为 kg，写入数据库时需 ×1000 转为 g
}
```

#### 4. 运费乘数配置（FREIGHT_MULTIPLIER）
```javascript
FREIGHT_MULTIPLIER: {
  'GC': 6.7  // GC 运费为美元，需 × 6.7 转为人民币
}
```

#### 5. other_fee 计算规则（OTHER_FEE_FORMULA）
```javascript
OTHER_FEE_FORMULA: {
  'GC': null  // GC 不提供费用拆分，other_fee 留空
}
```

---

## 🛠️ 使用方法

### **前置条件**

1. ✅ 确保 `tools/node_modules` 下已安装:
   - `xlsx`
   - `@supabase/supabase-js`

2. ✅ 确保 `customer_portal/.env.local` 中有正确的 Supabase 连接信息:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. ✅ 确保导入文件放在 `Data Import/` 目录下

### **执行导入**

**基本命令**:
```bash
node customer_portal/tools/import-freight-bill.js "<excel_file_path>"
```

**示例**:
```bash
node customer_portal/tools/import-freight-bill.js "customer_portal/Data Import/GC订单及运费.xlsx"
```

### **验证导入结果**

**查询数据库验证**:
```sql
-- 查看最近导入的 GC 运费记录（按 billing_date 排序）
SELECT tracking_no, billing_date, weight_g, freight, premium
FROM freight
WHERE tracking_no LIKE 'GC%'
ORDER BY billing_date DESC
LIMIT 10;

-- 统计 GC 运费记录数
SELECT COUNT(*) as total_count,
       SUM(freight) as total_freight_cny,
       AVG(freight) as avg_freight_cny,
       MIN(billing_date) as earliest_date,
       MAX(billing_date) as latest_date
FROM freight
WHERE tracking_no LIKE 'GC%';

-- 检查特定日期的运费记录
SELECT tracking_no, billing_date, weight_g, freight
FROM freight
WHERE billing_date >= '2026-10-01'
ORDER BY billing_date DESC, tracking_no;
```

---

## ⚠️ 错误处理策略

### **严格模式**

- ❌ **任何步骤出错** → 立即中断整个流程
- ❌ **数据库操作失败** → 输出错误信息并退出
- ⚠️ **缺少必需列** → 报错并中断
- ⚠️ **缺少 tracking_no 或 freight** → 跳过该记录，继续处理其他记录

### **常见错误与处理**

| 错误类型 | 原因 | 处理方法 |
|---------|------|---------|
| 无法识别物流商 | Excel 表头不包含 GC 关键字 | 检查文件是否为 GC 系统导出的标准格式 |
| 缺少必需列 | Excel 文件格式不正确 | 确认文件包含：客户单号、总费用 |
| Supabase 连接失败 | 网络问题或配置错误 | 检查 `.env.local` 配置，等待网络恢复后重试 |
| URL 长度限制 | 批量查询 ID 过多 | 已自动分批查询（每批 100 条） |
| 主键冲突 | 同一运单号多条记录 | 已自动去重合并费用 |

---

## 📁 文件清单

| 文件路径 | 说明 |
|---------|------|
| `tools/import-freight-bill.js` | 主导入脚本（支持所有物流商） |
| `source/lib/admin/carrier-configs/freight-bill-config.js` | 运费导入配置文件 |
| `tools/lib/admin/carrier-configs/freight-bill-config.js` | 配置文件镜像（CLI 使用） |
| `workflow/GC_FREIGHT_IMPORT_WORKFLOW.md` | 本文档 |

---

## 📊 执行结果示例

### **成功执行输出**

```
=== 开始 GC 运费导入工作流 ===

📖 步骤1: 读取 Excel 文件...
   文件: GC订单及运费.xlsx
   总记录数: 500
   列数: 4
   ✅ 列名验证通过

🔍 步骤2: 识别物流商...
   ✅ 识别为: GC 物流（易可达）

📋 当前配置的列映射:
   ✅ tracking_no ← 客户单号
   ✅ billing_date ← 出库时间
   ✅ weight_g ← 计费重量（KG）
   ✅ freight ← 总费用

⏸️  请确认以上映射关系是否正确？
是否继续？(y/n): y
✅ 用户确认，继续执行...

🔄 步骤3: 解析运费数据...
   💱 运费乘数: 10.50 × 6.7 = 70.35
   💱 运费乘数: 8.20 × 6.7 = 54.94
   ...
   ✅ 解析完成: 500 条记录

💾 步骤4: 写入 freight 表...
   ✅ 新增: 450 条
   ⏭️  跳过: 30 条（freight 相同）
   🔄 更新: 20 条（freight 不同，费用相加）

========== 执行报告 ==========
总记录数: 500
  - 新增: 450
  - 跳过: 30
  - 更新: 20
  - 错误: 0
================================

✅ GC 运费导入完成！
```

---

## 📝 注意事项

### **数据质量**

- ✅ 确保 Excel 文件为 GC 系统导出的标准格式
- ✅ 确保表头包含：跟踪号、出库时间、计费重量（KG）、总费用
- ✅ 确保日期格式正确（Excel 序列号或标准日期格式）
- ✅ 确保运费金额为美元（USD），脚本会自动 × 6.7 转换为人民币

### **汇率更新**

- ⚠️ 当前汇率乘数为 **6.7**，如汇率变动需更新配置文件
- 📝 修改位置：`freight-bill-config.js` → `FREIGHT_MULTIPLIER.GC`
- 🔄 修改后需同步镜像到 `tools/lib/admin/carrier-configs/freight-bill-config.js`

### **性能优化**

- ✅ 批量查询已存在记录（每批 100 条）
- ✅ 批量写入数据库（每批 50 条）
- ✅ 文件内去重减少数据库操作

### **与其他物流商的区别**

| 特性 | GC 物流 | 华翰 | 燕文 | 云途 | 雄九 |
|------|--------|------|------|------|------|
| 运费乘数 | ✅ × 6.7 | ❌ | ❌ | ❌ | ❌ |
| 重量单位 | kg → g | kg → g | g（不变） | kg → g | kg → g |
| 费用拆分 | ❌ 仅有总额 | ✅ | ❌ | ✅ | ✅（无挂号费） |
| 运单号列名 | 客户单号 | 运单号 | 运单号 | 运单号 | 转单号 |
| 日期列名 | 出库时间 | 到货时间 | 账单日期 | 发生时间 | 收货时间 |

---

## 🔄 更新日志

### v1.0 (2026-11-04)
- ✅ 初始版本：GC 物流运费导入工作流
- ✅ 支持运费乘数转换（USD → CNY，× 6.7）
- ✅ 支持重量单位转换（kg → g，× 1000）
- ✅ 集成到现有 `import-freight-bill.js` 脚本
- ✅ 配置文件新增 `FREIGHT_MULTIPLIER` 配置项

---

## 🧑‍💼 维护者

- **配置文件**: `source/lib/admin/carrier-configs/freight-bill-config.js`
- **主脚本**: `tools/import-freight-bill.js`
- **工作流文档**: `workflow/GC_FREIGHT_IMPORT_WORKFLOW.md`

---

**最后更新**: 2026-11-04  
**文档状态**: ✅ 当前使用
