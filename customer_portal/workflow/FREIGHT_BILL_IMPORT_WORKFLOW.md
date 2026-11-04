# 运费账单导入工作流文档

**版本**: 2.9  
**创建日期**: 2026-08-11  
**最后更新**: 2026-10-23  
**状态**: ✅ 已创建

---

## 📋 工作流概述

本工作流用于从各物流公司系统导出的 Excel 文件中批量导入运费账单数据，自动识别物流商、映射列名、插入到 freight 表（已存在则跳过，不覆盖更新）。

### **核心逻辑**
1. **自动识别物流商**（基于 Excel 表头关键字，支持 4 种物流商）
2. **首次导入时确认列映射关系**（交互式确认）
3. **保存映射配置到配置文件**（每个物流商独立配置）
4. **插入到 freight 表**（**新增文件内去重逻辑**：同一运单号多条记录时，费用列相加合并为一条
-  **修改写入逻辑为三路分支**：不存在→插入，freight 相同→跳过，freight 不同→费用相加后更新）
5. **记录未匹配运单号到日志文件**

---

## 🎯 输入要求

### **Excel 文件格式**
- **文件类型**: `.xlsx` / `.xls`
- **必需列**（至少包含以下之一）:
  - `tracking_no` - 运单号（主匹配键）
  - `freight` - 总费用

### **支持的物流商**

| 物流商 | 标识关键字（运费文件独有列名） | 配置名称 |
|--------|-------------------------------|---------|
| 华翰物流 | 到货时间、总费用、其它杂费 | HH EXPRESS |
| 燕文物流 | 账单日期、账单金额 | YANWEN |
| 云途物流 | 发生时间、交易金额 | YUNExpress |
| 雄九物流 | 转单号、收货时间、总金额 | XJ LOGISTICS |
| GC 物流（易可达） | 出库时间、GC、易可达 | GC |

> ⚠️ **重要**：运费文件的识别关键字与运单导入（`CARRIER_SHIPMENT_IMPORT_WORKFLOW`）完全不同！
> - 运单文件列名：运单号、状态、转单号、跟踪号、订单状态...
> - 运费文件列名：到货时间、账单日期、发生时间、收货时间、计费重量、总费用...
> - 两者使用独立的配置文件，不可混用

---

## 📊 各物流商字段映射（Excel → freight 表）

### **华翰物流 (HH EXPRESS)**

**实际文件表头**: 到货时间, 客户单号, 运单号, 跟踪单号, 销售产品, 货物类型, 目的国家, 计费重量, 运费, 燃油费, 挂号费, 其它杂费, 总费用

| 导入文件字段 | 说明 | 数据库字段 | 备注 |
|-------------|------|-----------|------|
| 运单号 | 用来查询 | tracking_no | |
| 到货时间 | 结算日期 | billing_date | |
| 计费重量 | 计费重量 | weight_g | 文件中单位 kg → 数据库 g（×1000） |
| 总费用 | 总费用 | freight | |
| 运费 | 基础运费 | freight_fee | |
| 挂号费 | 挂号费 | registered_fee | |
| — | 其他费用 | other_fee | **计算字段** = freight - freight_fee - registered_fee（含燃油费+其它杂费） |

### **燕文物流 (YANWEN)**

**实际文件表头**: 发货账号, 运单号, 订单号, 转单号, 流水号, 产品名称, 目的地, 实际重量(g), 计费重量(g), 长(cm), 宽(cm), 高(cm), 计费时间, 账单日期, 账单金额(元), 费用类型

| 导入文件字段 | 说明 | 数据库字段 | 备注 |
|-------------|------|-----------|------|
| 运单号 | 用来查询 | tracking_no | |
| 账单日期 | 结算日期 | billing_date | |
| 计费重量(g) | 计费重量 | weight_g | 文件中单位 g → 数据库 g（无需转换） |
| 账单金额(元) | 总费用 | freight | |
| — | 基础运费 | freight_fee | 燕文不提供拆分，留空 |
| — | 挂号费 | registered_fee | 燕文不提供拆分，留空 |
| — | 其他费用 | other_fee | 燕文不提供拆分，留空 |

> ⚠️ 注意：燕文文件的列名包含单位后缀，如 `计费重量(g)`、`账单金额(元)`，配置中必须完全匹配。

### **云途物流 (YUNExpress)**

**实际文件表头**: 交易类型, 发生时间, 交易产品, 国家代码, 国家名称, 币种代码, 客户单号, 运单号, 跟踪号, 计费重, 体积重, 实重, 交易金额, 运费, 燃油费, 挂号费, 处理费, VAT增值税, 重派费, 关税预付手续费, 偏远附加费, 退回费用, 特殊产品加收费, 其他费, 备注

| 导入文件字段 | 说明 | 数据库字段 | 备注 |
|-------------|------|-----------|------|
| 运单号 | 用来查询 | tracking_no | |
| 发生时间 | 结算日期 | billing_date | |
| 计费重 | 计费重量 | weight_g | 文件中单位 kg → 数据库 g（×1000） |
| 交易金额 | 总费用 | freight | |
| 运费 | 基础运费 | freight_fee | |
| 挂号费 | 挂号费 | registered_fee | |
| — | 其他费用 | other_fee | **计算字段** = freight - freight_fee - registered_fee（含燃油费+处理费+VAT等所有附加费） |

### **雄九物流 (XJ LOGISTICS)**

**实际文件表头**: 原单号, 转单号, 收货时间, 运输方式, 国家, 计费重, 运费, 燃油, 杂费, 总金额, 件数, 内部单号, 备注, 收件人名, 收件人邮编, 包裹材积, 代收货款, 代收货款币种

| 导入文件字段 | 说明 | 数据库字段 | 备注 |
|-------------|------|-----------|------|
| 转单号 | 用来查询 | tracking_no | |
| 收货时间 | 结算日期 | billing_date | |
| 计费重 | 计费重量 | weight_g | 文件中单位 kg → 数据库 g（×1000） |
| 总金额 | 总费用 | freight | |
| 运费 | 基础运费 | freight_fee | |
| — | 挂号费 | registered_fee | 雄九不提供，留空 |
| — | 其他费用 | other_fee | **计算字段** = freight - freight_fee（含燃油+杂费） |

### **GC 物流（易可达）**

**实际文件表头**: 订单参考号, 订单状态, 创建时间, 出库时间, 跟踪号, 实际送达时间, 总费用, 订单总体积（CM³）, 实际重量（KG）, 计费重量（KG）

| 导入文件字段 | 说明 | 数据库字段 | 备注 |
|-------------|------|-----------|------|
| 跟踪号 | 用来查询 | tracking_no | |
| 出库时间 | 结算日期 | billing_date | |
| 计费重量（KG） | 计费重量 | weight_g | 文件中单位 kg → 数据库 g（×1000） |
| 总费用 | 总费用 | freight | **需 × 6.7 转换为人民币** |
| — | 基础运费 | freight_fee | GC 不提供拆分，留空 |
| — | 挂号费 | registered_fee | GC 不提供拆分，留空 |
| — | 其他费用 | other_fee | GC 不提供拆分，留空 |

> ⚠️ 注意：GC 物流的运费文件以美元计价，需乘以汇率 6.7 转换为人民币后写入数据库。详见 `GC_FREIGHT_IMPORT_WORKFLOW.md`。

### **字段映射差异汇总**

| 特性 | 华翰 HH EXPRESS | 燕文 YANWEN | 云途 YUNExpress | 雄九 XJ LOGISTICS | GC 物流 |
|------|----------------|-------------|-----------------|-------------------|---------|
| 运单号列名 | 运单号 | 运单号 | 运单号 | 转单号 | 跟踪号 |
| 日期列名 | 到货时间 | 账单日期 | 发生时间 | 收货时间 | 出库时间 |
| 重量列名 | 计费重量 | 计费重量(g) | 计费重 | 计费重 | 计费重量（KG） |
| 重量单位 | kg（×1000） | g（不变） | kg（×1000） | kg（×1000） | kg（×1000） |
| 总费用列名 | 总费用 | 账单金额(元) | 交易金额 | 总金额 | 总费用 |
| 运费乘数 | ❌ | ❌ | ❌ | ❌ | ✅ × 6.7 |
| 有运费拆分 | ✅ freight_fee + registered_fee | ❌ 仅有总额 | ✅ freight_fee + registered_fee | ✅ freight_fee（无挂号费） | ❌ 仅有总额 |
| other_fee 计算 | freight - freight_fee - registered_fee | 留空 | freight - freight_fee - registered_fee | freight - freight_fee | 留空 |

---

## 🔄 工作流程

### **步骤1: 读取 Excel 文件**
- 检查文件是否存在
- 解析第一个工作表
- 提取表头和数据行
- 统计记录数和列数

### **步骤2: 识别物流商并确认映射关系**
- 扫描 Excel 表头
- 匹配配置文件 `FREIGHT_BILL_CONFIG.CARRIER_IDENTIFIERS` 中的关键字
- 确定物流商名称
- **⚠️ 显示当前配置的列映射，等待用户确认**
- **如果是首次导入，要求用户提供映射关系**
- **如果用户取消，停止执行并提供修改指导**

> ℹ️ 步骤1和步骤2的操作流程与 `CARRIER_SHIPMENT_IMPORT_WORKFLOW` 一致，但识别关键字不同（因为运费文件和运单文件的列名不同）。

### **步骤3: 解析运费数据 + 文件内去重**
- 根据物流商的列映射（`CARRIER_COLUMN_MAPS`）提取数据
- **重量单位转换**（`WEIGHT_UNIT`）：华翰/云途/雄九的文件重量为 kg，需 ×1000 转为 g；燕文文件已经是 g，无需转换
- **计算 other_fee**（`OTHER_FEE_FORMULA`）：
  - 华翰/云途：other_fee = freight - freight_fee - registered_fee
  - 雄九：other_fee = freight - freight_fee
  - 燕文：other_fee 留空（null）
- **燕文特殊处理**：freight_fee、registered_fee、other_fee 均留空（null）
- **雄九特殊处理**：registered_fee 留空（null）
- 验证必需字段（tracking_no, freight）
- 过滤无效记录
- **数值 0 与 null 的区分规则**：
  - 如果文件中某字段**有值且为 0**（如运费=0），数据库写入 **0**
  - 如果某字段**不在该物流商的列映射中**（如燕文无 freight_fee/registered_fee/other_fee），数据库写入 **null**
  - 判断依据：列映射（CARRIER_COLUMN_MAPS）中有的字段 → 解析实际值（含 0）；列映射中没有的字段 → 不写入（默认 null）

- **文件内去重（v2.9 新增）**：
  - 解析完成后，检查是否有同一运单号的多条记录
  - 如果有重复，将费用列（freight、freight_fee、registered_fee、other_fee）相加合并为一条
  - 非费用字段（billing_date、weight_g 等）取第一条记录的值
  - 合并后的记录数会记录在日志中

### **步骤4: 写入 freight 表（比较 + 插入/跳过/更新）**
- **批量查询**已存在的 tracking_no 及其费用字段（freight、freight_fee、registered_fee、other_fee）
- **三条分支逻辑（v2.9 更新）**：
  - **不存在** → 插入新记录
  - **存在且 freight 相同** → 跳过，记录日志
  - **存在且 freight 不同** → 将所有费用列相加后更新（例：现有 freight=12，新记录 freight=-3，更新后 freight=9）
- 报告输出新增、跳过、更新、错误的数量

### **步骤5: 生成执行报告**
- 统计各项数量
- **输出所有未匹配的运单号列表**
- 提供操作建议

### **步骤6: 保存运行日志**
- 将完整执行过程保存到 `Data Import/Process log` 文件夹
- 日志文件名格式：`{CARRIER}_Freight_{TIMESTAMP}.log`
- 包含时间戳、操作步骤、统计结果、未匹配运单号

---

## 🔧 配置文件说明

### **配置文件位置**
```
lib/admin/carrier-configs/freight-bill-config.js
```

### **配置结构**

```javascript
const FREIGHT_BILL_CONFIG = {

  // 物流商标识符（基于运费文件独有列名）
  // ⚠️ 与 carrier-shipment-config.js 的 CARRIER_IDENTIFIERS 不同！
  CARRIER_IDENTIFIERS: {
    // 华翰物流
    '到货时间': 'HH EXPRESS',
    '总费用': 'HH EXPRESS',
    '其它杂费': 'HH EXPRESS',
    // 燕文物流
    '账单日期': 'YANWEN',
    '账单金额(元)': 'YANWEN',
    // 云途物流
    '发生时间': 'YUNExpress',
    '交易金额': 'YUNExpress',
    // 雄九物流
    '转单号': 'XJ LOGISTICS',
    '收货时间': 'XJ LOGISTICS',
    '总金额': 'XJ LOGISTICS'
  },

  // 各物流商的列映射（Excel列名 → freight表字段）
  // ⚠️ 列名必须与实际 Excel 文件表头完全一致（包括单位后缀）
  CARRIER_COLUMN_MAPS: {
    'HH EXPRESS': {
      '运单号': 'tracking_no',
      '到货时间': 'billing_date',
      '计费重量': 'weight_g',
      '总费用': 'freight',
      '运费': 'freight_fee',
      '挂号费': 'registered_fee'
    },
    'YANWEN': {
      '运单号': 'tracking_no',
      '账单日期': 'billing_date',
      '计费重量(g)': 'weight_g',   // 注意：包含单位后缀 (g)
      '账单金额(元)': 'freight'     // 注意：包含单位后缀 (元)
    },
    'YUNExpress': {
      '运单号': 'tracking_no',
      '发生时间': 'billing_date',
      '计费重': 'weight_g',
      '交易金额': 'freight',
      '运费': 'freight_fee',
      '挂号费': 'registered_fee'
    },
    'XJ LOGISTICS': {
      '转单号': 'tracking_no',
      '收货时间': 'billing_date',
      '计费重': 'weight_g',
      '总金额': 'freight',
      '运费': 'freight_fee'
    }
  },

  // 重量单位配置（'kg' 需 ×1000 转为 g，'g' 无需转换）
  WEIGHT_UNIT: {
    'HH EXPRESS': 'kg',
    'YANWEN': 'g',
    'YUNExpress': 'kg',
    'XJ LOGISTICS': 'kg'
  },

  // other_fee 计算规则（null = 不计算，留空）
  OTHER_FEE_FORMULA: {
    'HH EXPRESS': 'freight - freight_fee - registered_fee',
    'YANWEN': null,
    'YUNExpress': 'freight - freight_fee - registered_fee',
    'XJ LOGISTICS': 'freight - freight_fee'
  },
```

### **如何添加新物流商配置**

1. **在 CARRIER_IDENTIFIERS 中添加标识关键字**（必须是该物流商运费文件独有的列名）
   ```javascript
   '新物流商独有列名': 'NEW_CARRIER'
   ```

2. **在 CARRIER_COLUMN_MAPS 中添加列映射**（列名必须与实际 Excel 文件表头完全一致）
   ```javascript
   'NEW_CARRIER': {
     'Excel列名1': 'tracking_no',
     'Excel列名2': 'billing_date',
     'Excel列名3': 'weight_g',
     'Excel列名4': 'freight'
   }
   ```

3. **在 WEIGHT_UNIT 中配置重量单位**
   ```javascript
   'NEW_CARRIER': 'kg'  // 或 'g'
   ```

4. **在 OTHER_FEE_FORMULA 中配置 other_fee 计算规则**
   ```javascript
   'NEW_CARRIER': 'freight - freight_fee - registered_fee'
   // 或 null（如果不提供费用拆分）
   ```

---

## 💻 使用方法

### **基本用法**

```bash
node tools/import-freight-bill.js <excel_file_path>
```

### **示例**

```bash
# 燕文运费账单
node tools/import-freight-bill.js "Data Import\\燕文运费0807-0812.xlsx"

# 云途运费账单
node tools/import-freight-bill.js "Data Import\\云途运费0701-0812.xlsx"

# HH Express 运费账单
node tools/import-freight-bill.js "Data Import\\HH运费0807-0812.xlsx"

# 雄九运费账单
node tools/import-freight-bill.js "Data Import\\雄九运费0807-0812.xlsx"
```

---

## 📊 执行报告示例

```
========== 执行报告 ==========
总记录数: 100
有效记录数: 98
Freight 表新增: 50
Freight 表跳过（freight 相同）: 48
Freight 表更新（费用相加）: 2
订单状态更新: 85
订单状态跳过: 13
未匹配运单: 2
================================


```

---

## 🗂️ 日志文件

### **保存位置**
```
Data Import/Process log/{CARRIER}_Freight_{TIMESTAMP}.log
```

### **日志内容**
- 执行时间戳
- 每个步骤的详细输出
- 统计结果
- 未匹配运单号列表
- 错误信息（如有）

---

## ⚠️ 注意事项

1. **首次导入需要确认映射关系**
   - 脚本会显示 Excel 列名和数据库字段的映射
   - 输入 `y` 确认继续
   - 输入 `n` 取消并提供正确的映射关系

2. **必需字段**
   - `tracking_no`（运单号）- 必须
   - `freight`（总费用）- 必须
   - `billing_date`（结算日期）- 建议
   - `weight_g`（计费重量）- 建议

3. **列名必须完全匹配**
   - 配置文件中的 Excel 列名必须与实际文件表头完全一致
   - 特别注意燕文文件的列名包含单位后缀：`计费重量(g)`、`账单金额(元)`
   - 如果物流商更新了导出格式，需要同步更新配置文件

4. **重量单位转换**
   - 华翰/云途/雄九的文件重量单位为 kg，脚本自动 ×1000 转为 g
   - 燕文的文件重量单位已经是 g，无需转换
   - 配置在 `WEIGHT_UNIT` 中

5. **other_fee 计算**
   - 华翰/云途：other_fee = freight - freight_fee - registered_fee
   - 雄九：other_fee = freight - freight_fee（无挂号费）
   - 燕文：other_fee 留空（不提供费用拆分）
   - 计算规则在 `OTHER_FEE_FORMULA` 中配置

5.5. **数值 0 与 null 的处理**
   - 文件中值为 0 的数值字段（如 freight=0, freight_fee=0），数据库写入 **0**
   - 物流商不提供拆分的字段（如燕文无 freight_fee/registered_fee/other_fee），数据库写入 **null**
   - 解析代码中不能用 `parseFloat(val) || null`（会把 0 变 null），应使用 `isNaN(parseFloat(val)) ? null : parseFloat(val)`


6. **插入逻辑（Insert-Only）**
   - 基于 `tracking_no` 判断是否已存在
   - 已存在则跳过（不更新），仅记录日志
   - 不存在则插入新记录
   - 使用批量查询和批量插入提高效率

7. **状态更新规则**
   - 只更新 `shipment_status` 不为 'shipped' 的记录
   - 已是 'shipped' 的记录会被跳过
   - 未找到的记录会记录到日志

8. **错误处理**
   - 单条记录失败不影响其他记录
   - 所有错误都会记录到日志
   - 最终报告会显示错误数量

---

## 🔄 与运单导入的对比

| 特性 | 运单导入 | 运费账单导入 |
|------|----------|--------------|
| 工作流文档 | CARRIER_SHIPMENT_IMPORT_WORKFLOW | FREIGHT_BILL_IMPORT_WORKFLOW |
| 配置文件 | carrier-shipment-config.js | freight-bill-config.js |
| 脚本 | import-carrier-shipments.js | import-freight-bill.js |
| 目标表 | order_shipment | freight |
| 主要目的 | 更新运单状态 | 导入运费成本 |
| 状态更新 | 不更新 | 不更新（运费导入仅写入 freight 表） |
| 数据操作 | 只更新 | Insert-Only（已存在跳过，不存在新增） |
| 物流商识别 | 相同 4 种 | 相同 4 种 |
| **识别关键字** | **运单文件列名**（状态、跟踪号、订单状态...） | **运费文件列名**（到货时间、账单日期、发生时间...） |
| 单位转换 | 无 | 重量 kg→g（燕文除外） |
| 计算字段 | 无 | other_fee（燕文除外） |

---

## 📞 问题排查

### **无法识别物流商**
- 检查 Excel 表头是否包含 `CARRIER_IDENTIFIERS` 中的关键字
- 确认使用的是运费文件（不是运单文件，两者列名不同）
- 在配置文件中添加新的标识关键字

### **列映射错误**
- 首次导入时仔细检查映射关系
- 确认配置文件中的列名与实际 Excel 文件表头完全一致（包括单位后缀）
- 如需修改，更新配置文件 `CARRIER_COLUMN_MAPS` 中对应物流商的映射

### **重量数据异常**
- 检查 `WEIGHT_UNIT` 配置是否与实际文件单位一致
- 华翰/云途/雄九应为 'kg'，燕文应为 'g'

### **other_fee 计算错误**
- 检查 `OTHER_FEE_FORMULA` 配置是否正确
- 确认源字段（freight、freight_fee、registered_fee）是否已正确映射

### **插入失败**
- 检查 freight 表结构是否正确
- 确认字段类型匹配

---

## 📂 相关文件

| 文件路径 | 说明 |
|---------|------|
| `tools/import-freight-bill.js` | 主脚本 |
| `lib/admin/carrier-configs/freight-bill-config.js` | **运费账单配置文件**（物流商识别、列映射、重量单位、费用计算公式） |
| `tools/import-carrier-shipments.js` | 运单导入脚本（参考） |
| `lib/admin/carrier-configs/carrier-shipment-config.js` | 运单导入配置文件（参考，不可混用） |

---

## 🔄 更新日志

### **v2.9 (2026-10-23)**
- 🔗 **新增文件内去重逻辑**：同一运单号多条记录时，费用列相加合并为一条
- 🔄 **修改写入逻辑为三路分支**：不存在→插入，freight 相同→跳过，freight 不同→费用相加后更新
- 📊 **执行报告增强**：新增文件内合并数、更新数统计

### **v2.8 (2026-10-23)**
- 🗑️ **移除全零费用记录过滤逻辑**：不再检查 FEE_COLUMNS，所有有效记录（有 tracking_no 和 freight）均写入数据库
- 🗑️ **移除 FEE_COLUMNS 配置项**：配置文件中不再定义费用列

### **v2.7 (2026-10-23)**
-  **全零费用过滤扩展**：检查所有费用列（`FEE_COLUMNS`），不仅限于映射到 DB 的字段
  - 新增配置项 `FEE_COLUMNS`：定义每种物流商的所有费用列
  - 云途 12 列、华翰 5 列、雄九 4 列、燕文 1 列

### **v2.6 (2026-10-23)**
- 🚫 **新增全零费用记录过滤**：当 freight、freight_fee、registered_fee 均为 0 或空时，跳过不写入数据库

### **v2.5 (2026-10-23)**
- 🔧 **修复数值 0 被转为 null 的问题**：`parseFloat(val) || null` 改为 `isNaN(num) ? null : num`
- 📝 **明确 0 与 null 的区分规则**：文件中有值 0 写 0，未映射字段写 null（如燕文无 freight_fee）

### **v2.4 (2026-10-23)**
- 🔄 **修改导入逻辑为 Insert-Only**：已存在于 freight 表的运单跳过不更新，仅新增不存在的记录
- ⚡ **批量查询优化**：使用 `.in()` 批量查询已存在的 tracking_no，替代逐条查询
- 📝 **日志增强**：跳过的记录会逐条记录到日志

### **v2.2 (2026-10-23)**
- 🔧 **根据实际文件验证修正列名**：燕文 `计费重量` → `计费重量(g)`、`账单金额` → `账单金额(元)`（包含单位后缀）
- 📝 **新增各物流商实际文件表头**：在配置和文档中记录每种物流商文件的完整表头，方便对照
- 📝 **新增 other_fee 包含内容说明**：明确 other_fee 包含哪些附加费用（燃油费、处理费、VAT等）
- ⚠️ **新增「列名必须完全匹配」注意事项**：强调配置中的列名必须与实际文件表头一致

### **v2.1 (2026-10-23)**
- 🔧 **创建独立配置文件** `freight-bill-config.js`
- 📝 **修正物流商识别关键字**：基于运费文件独有列名
- ⚠️ **明确区分运单/运费两套配置**

### **v2.0 (2026-10-23)**
- 🚀 **对齐运单导入工作流的物流商识别机制**
- 📝 **新增完整的各物流商字段映射表和差异汇总表**

### **v1.0 (2026-08-11)**
- 📄 初始版本发布

---

**最后更新**: 2026-10-23  
**维护者**: Lingma AI Assistant  
**文档状态**: ✅ 已创建
