# MA 订单导入工作流文档

**版本**: v5.5  
**创建日期**: 2026-10-14  
**最后更新**: 2026-10-24  
**状态**: ✅ 当前使用  
**适用数据库架构**: orders + order_pricing 拆分后，carrier 字段已改为 TEXT 类型

---

## 📋 工作流概述

本工作流用于将 MA 系统导出的订单文件自动导入到 Supabase 数据库，包括：
1. 解析和验证订单数据
2. 物流公司识别与转换
3. 创建/更新订单记录（双表写入）
4. 生成执行报告

### 核心特性

- **双表写入**: 基本信息写入 `orders`，价格信息写入 `order_pricing`
- **严格模式**: 任何错误中断整个流程
- **物流公司识别**: 从"物流公司"列读取中文名称 → 查配置文件转换为英文值
- **物流渠道直写**: 从"物流渠道"列直接读取写入 `channel_id`
- **重复订单处理**: 遇到已存在订单时直接覆盖所有字段
- **运单号保护**: 已存在运单号的订单不更新 `order_shipment` 表，仅更新 `orders` 等其他表

### 导入脚本与文件

| 导入脚本 | 适用文件 | 格式 |
|---------|---------|------|
| `import-ma-orders-from-xls.js` | MA 系统导出的文件 | `.xls` / `.xlsx` / `.csv` |
| 前端导入界面 (`/admin/upload/orders`) | MA 系统导出的文件 | `.xls` / `.xlsx` / `.csv` |

**注意**: 前端导入界面与 CLI 脚本使用相同的业务逻辑（v5.5+）

---

## 🗄️ 数据库架构

### 表结构概览

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
       │ 1:N
       ├──────────────→ order_shipment (物流信息)
```

### 关键字段说明

#### orders 表（基本信息）
- `transaction_id`: 交易编号（唯一标识，用于判断订单是否存在）
- `order_number`: 订单编号
- `shop_name`: 店铺名称
- `order_status`: 订单状态（枚举值）
- `carrier`: 物流公司（TEXT 类型，存储英文值）
- `channel_id`: 物流渠道（从"物流渠道"列直接读取）
- `shipment_date`: 交运时间（双写至 orders 和 order_shipment）
- `cancel_date`: 作废时间（优先使用作废时间，否则使用退货签收入库时间）

#### order_items 表（商品明细）
- `order_id`: 关联 orders 表的 ID
- `sku`: SKU 编码
- `qty`: 商品数量
- `sku_standard_price`: SKU 标准价格（保留原始精度）
- `platform_product_title`: 平台商品标题
- `sku_image_url`: SKU 图片链接

#### order_pricing 表（价格信息）
- `order_id`: 关联 orders 表的 ID
- `order_total_value`: 订单总金额
- `order_ex_rate`: 汇率
- `order_cny_value`: 人民币金额（= order_total_value × order_ex_rate）

---

## 🔄 执行流程详解

### 步骤 1: 读取并验证 Excel 文件

**操作**:
1. 使用 XLSX 库读取 Excel 文件（`.xls` / `.xlsx` / `.csv`）
2. 验证必需列是否完整
3. 统计总记录数和列数

**必需列（18个）**:
- 订单编号、交易编号、店铺名、SKU、商品数量
- 付款时间、订单状态、国家、是否重发订单、重发原因
- 订单总金额、汇率(原币)、订单商品名称、商品编号(ItemId)
- 货运单号、交运时间、物流渠道、发货时间

**可选列（10个）**:
- 邮政编码、退货标识、退货签收入库时间、退货签收入库数量
- 作废时间、物流公司、平台商品标题、SKU原始图片链接
- 库存SKU标准售价、币种

**验证规则**:
- ❌ 缺少任何必需列 → 报错并中断流程
- ✅ 可选列缺失 → 继续执行，对应字段设为 NULL

**输出示例**:
```
📖 步骤1: 读取 Excel 文件...
   总记录数: 1110
   列数: 28
   ✅ 列名验证通过
```

---

### 步骤 2: 数据转换与业务规则应用

**操作**:
1. 按"订单编号"分组，同一订单的多个 SKU 行合并
2. 应用数据转换规则
3. 执行物流公司识别
4. 应用业务规则

#### 2.1 数据格式转换

| 字段类型 | 转换规则 | 示例 |
|---------|---------|------|
| Excel 日期（序列号） | 使用 XLSX 库自动转换为 JavaScript Date | 46305.001 → 2026-10-10 |
| 日期字段 | 格式化为 `YYYY-MM-DD` | 2026-10-10 |
| 日期时间字段 | 格式化为 `YYYY-MM-DD HH:mm:ss` | 2026-10-10 15:14:13 |
| 订单编号、商品编号 | 转为字符串，处理 Excel CSV 转义 `="..."` | `="7435443732673"` → `7435443732673` |
| 金额字段 | 保留原始精度 | 123.456 → 123.456 |
| 汇率字段 | 保留原始精度 | 7.085 → 7.085 |
| 数量字段 | 转为整数 | 2.0 → 2 |

#### 2.2 枚举值映射

**订单状态映射**:
| 中文值 | 英文值 |
|--------|--------|
| 配货中 | processed |
| 已发货 | shipped |
| 待处理 | received |
| 待审核 | processed |
| 已作废 | cancelled |

**异常代码映射**:
| 中文值 | 英文值 |
|--------|--------|
| 发错 | wrong_item |
| 丢包 | package_lost |
| 破损 | damaged |
| 漏发 | missing_item |
| 与实物不符 | wrong_item |
| 更换渠道 | change_shipping |
| 大件分单 | change_shipping |
| 更换运单 | change_shipping |
| SKU混淆 | shopify_error |
| 客户要求 | customer_request |
| 修改信息 | customer_request |
| 修改地址 | amend_info |

#### 2.3 物流公司识别

**识别策略**（单一来源）:
1. 从"物流公司"列读取中文名称
2. 查配置文件 `ma-order-import-config.js` 中的 `CARRIER_ZH_TO_EN` 映射表
3. 转换为英文值写入 `carrier` 字段

**当前映射表**:
| 中文名称 | 英文值 |
|---------|--------|
| 燕文物流(新) | YANWEN |
| 云途(新) | YUNExpress |
| HH | HH EXPRESS |
| 雄九供应链 | XJ LOGISTICS |

**规则约束**:
- ✅ 匹配成功 → 写入英文值
- ⚠️ 匹配失败 → `carrier` 设为 NULL，输出警告但继续（不中断）
- ❌ 不再使用运单号前缀兜底识别（v5.0 移除）

#### 2.4 物流渠道直写

**操作**:
- 从"物流渠道"列直接读取值
- 写入 `channel_id` 字段
- 不做任何转换或验证

#### 2.5 作废时间回填规则

**规则**:
```javascript
cancelDate = cancelDateRaw || returnSignDate
```

**说明**:
- 优先使用"作废时间"列的值
- 如果"作废时间"为空，则使用"退货签收入库时间"
- 两者都为空则设为 NULL

#### 2.6 交运时间双写规则

**操作**:
- 将"交运时间"同时写入:
  - `orders.shipment_date`
  - `order_shipment.shipment_date`

#### 2.8 作废订单运单状态同步规则

**场景**: 订单状态为 `cancelled`（已作废）且该订单有运单号

**处理逻辑**:
```javascript
// 运单状态跟随订单状态
if (order_status === 'cancelled') {
  shipment_status = 'cancelled';
} else {
  shipment_status = 'created';  // 默认值
}
```

**规则约束**:
- ✅ 仅当 `order_status` 为 `cancelled` 时，`shipment_status` 才写入 `cancelled`
- ✅ 其他订单状态（shipped/processed/received）保持默认值 `created`
- ✅ 无运单号的 cancelled 订单不创建 `order_shipment` 记录（现有逻辑不变）
- ✅ 已存在的 cancelled 订单重新导入时，运单状态自动从 `created` 更正为 `cancelled`

#### 2.7 SKU 去重合并规则

**场景**: 同一订单中相同 SKU 出现多次（不同 ItemId）

**处理逻辑**:
```javascript
// 相同 SKU 合并数量
if (sku already exists) {
  existingItem.qty += newItem.qty;
} else {
  items.push(newItem);
}
```

**示例**:
- 订单 `7435443732673` 中 SKU `MAKIT00083DF|YA` 出现 2 次（数量分别为 1 和 2）
- 合并后: SKU `MAKIT00083DF|YA` 数量 = 3

**输出示例**:
```
🔄 步骤2: 解析数据并按订单分组...
   唯一订单数: 1110
   应用业务规则: 物流公司识别、物流渠道直写、作废时间回填
   ✅ 数据转换完成
```

---

### 步骤 3: 检查订单存在性

**操作**:
1. 提取所有订单的 `transaction_id`
2. 分批查询数据库（每批 100 条，避免 URL 长度限制）
3. 将订单分为"已存在"和"新订单"两组

**分批查询逻辑**:
```javascript
// 避免 Supabase .in() 查询 URL 长度限制
for (let i = 0; i < transactionIds.length; i += 100) {
  const batch = transactionIds.slice(i, i + 100);
  const { data } = await supabase
    .from('orders')
    .select('transaction_id')
    .in('transaction_id', batch);
}
```

**规则约束**:
- ✅ 按 `transaction_id` 判断订单是否存在
- ✅ 每批最多 100 条（防止 URL 超出限制）
- ✅ 已存在订单 → 进入更新流程
- ✅ 新订单 → 进入创建流程

**输出示例**:
```
🔍 步骤3: 检查订单存在性...
   已存在订单: 476
   新订单: 634
```

---

### 步骤 4: 更新已存在订单

**操作**:
对每个已存在订单执行以下更新（直接覆盖所有字段）:

#### 4.1 更新 orders 表
- 更新所有字段（与创建新订单一致）
- 包括: order_number, shop_name, order_status, carrier, channel_id, shipment_date, cancel_date 等

#### 4.2 更新 order_pricing 表
- 删除旧记录
- 插入新记录（order_total_value, order_ex_rate, order_cny_value）

#### 4.3 更新 order_items 表
- 删除旧 items（按 order_id）
- 插入新 items（已去重合并）

#### 4.4 条件更新 order_shipment 表
- **先查询**: 检查 `order_shipment` 表中是否已存在该订单的运单号
- **如果已存在运单号**: 跳过 `order_shipment` 表的更新，保留原有物流信息
- **如果不存在运单号**: 插入新物流记录（如果有运单号）
- 运单状态规则：cancelled 订单 → `shipment_status = 'cancelled'`，其他 → `shipment_status = 'created'`

**规则约束**:
- ✅ 直接覆盖所有字段（不检测变更）
- ✅ 不再检查运单号冲突（v5.2 移除）
- ✅ 不再比较 items 变更（v5.1 移除）
- ✅ **v5.5 新增**: 已存在运单号的订单不更新 `order_shipment` 表

**输出示例**:
```
🔄 步骤4: 更新已存在订单...
   ℹ️  已有运单号的订单: 200 个，将跳过 order_shipment 更新
   成功更新: 476
   ⏭️  跳过 200 个已有运单号的订单的 order_shipment 更新
```

---

### 步骤 5: 创建新订单

**操作**:
对每个新订单执行以下创建:

#### 5.1 创建 orders 记录
- 插入所有基本信息字段
- 返回创建的 order ID

#### 5.2 创建 order_pricing 记录
- 关联 order ID
- 插入价格信息（order_total_value, order_ex_rate, order_cny_value）

#### 5.3 创建 order_items 记录
- 关联 order ID
- 插入商品明细（已去重合并）

#### 5.4 创建 order_shipment 记录
- 关联 order ID
- 插入物流信息（运单号、物流公司、交运时间等）
- 如果没有运单号 → 跳过此步骤
- 运单状态规则：cancelled 订单 → `shipment_status = 'cancelled'`，其他 → `shipment_status = 'created'`

**规则约束**:
- ✅ 无运单号 → 不创建 order_shipment 记录
- ✅ 所有字段一次性写入

**输出示例**:
```
✨ 步骤5: 创建新订单...
   成功创建: 634
```

---

### 步骤 6: 生成执行报告

**操作**:
统计并输出执行结果

**报告内容**:
```
========== 执行报告 ==========
总订单数: 1110
  - 已存在订单: 476
  - 新订单: 634
成功更新: 476
成功创建: 634
失败: 0
================================
```

**规则约束**:
- ✅ 输出所有统计数据
- ✅ 明确标注成功/失败数量

---

## 🛠️ 使用方法

### 前置条件

1. ✅ 确保 `tools/node_modules` 下已安装:
   - `xlsx`
   - `@supabase/supabase-js`

2. ✅ 确保 `customer_portal/.env.local` 中有正确的 Supabase 连接信息:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. ✅ 确保导入文件放在 `Data Import/` 目录下

### 执行导入

**基本命令**:
```bash
node customer_portal/tools/import-ma-orders-from-xls.js "<excel_file_path>"
```

**示例**:
```bash
node customer_portal/tools/import-ma-orders-from-xls.js "customer_portal/Data Import/MA_202608_NEW.csv"
```

### 验证导入结果

**执行验证脚本**:
```bash
node customer_portal/tools/verify-ma-import.js
```

**验证内容**:
- 抽样检查订单字段是否正确
- 统计物流商识别情况
- 检查店铺分布
- 验证新增字段写入情况

---

## ⚠️ 错误处理策略

### 严格模式

- ❌ **任何步骤出错** → 立即中断整个流程
- ❌ **数据库操作失败** → 输出错误信息并退出
- ⚠️ **物流公司未识别** → `carrier` 设为 NULL，输出警告但继续（不中断）

### 常见错误与处理

| 错误类型 | 原因 | 处理方法 |
|---------|------|---------|
| 缺少必需列 | Excel 文件格式不正确 | 检查文件是否为 MA 系统导出的标准格式 |
| Supabase 连接失败 | 网络问题或配置错误 | 检查 `.env.local` 配置，等待网络恢复后重试 |
| URL 长度限制 | 批量查询 ID 过多 | 已自动分批查询（每批 100 条） |
| 主键冲突 | 同一订单重复 SKU | 已自动去重合并数量 |
| 物流公司未识别 | 配置表中缺少映射 | 更新 `ma-order-import-config.js` 中的 `CARRIER_ZH_TO_EN` |

---

## 📁 文件清单

| 文件路径 | 说明 |
|---------|------|
| `tools/import-ma-orders-from-xls.js` | 主导入脚本（773 行） |
| `tools/lib/admin/column-maps/ma-order-import-config.js` | 导入配置文件（含物流公司映射） |
| `source/lib/carrier-config.ts` | 物流公司全局配置（全局配置源） |
| `tools/verify-ma-import.js` | 导入验证脚本 |
| `workflow/ORDER_IMPORT_WORKFLOW_Latest1.md` | 本文档 |

---

## 🔧 配置说明

### ma-order-import-config.js

**位置**: `tools/lib/admin/column-maps/ma-order-import-config.js`

**关键配置项**:

#### 1. 物流公司映射表（CARRIER_ZH_TO_EN）
```javascript
const CARRIER_ZH_TO_EN = {
  '燕文物流(新)': 'YANWEN',
  '云途(新)': 'YUNExpress',
  'HH': 'HH EXPRESS',
  '雄九供应链': 'XJ LOGISTICS'
};
```

#### 2. 枚举值映射
- **order_status**: 配货中→processed, 已发货→shipped, 待处理→received, 已作废→cancelled
- **abnormal_code**: 发错→wrong_item, 丢包→package_lost, 破损→damaged 等

#### 3. 业务规则常量
- `DEFAULT_SHIPMENT_STATUS`: 'created'
- `BATCH_SIZE`: 50（订单批量处理大小）

### carrier-config.ts

**位置**: `source/lib/carrier-config.ts`

**作用**: 物流公司全局配置源，包含公司中英文对照

---

## 📊 执行结果示例

### 成功执行输出

```
=== 开始订单导入工作流 ===

📖 步骤1: 读取 Excel 文件...
   总记录数: 1110
   列数: 28
   ✅ 列名验证通过

🔄 步骤2: 解析数据并按订单分组...
   唯一订单数: 1110
   应用业务规则: 物流公司识别、物流渠道直写、作废时间回填
   ✅ 数据转换完成

🔍 步骤3: 检查订单存在性...
   已存在订单: 476
   新订单: 634

🔄 步骤4: 更新已存在订单...
   成功更新: 476

✨ 步骤5: 创建新订单...
   成功创建: 634

========== 执行报告 ==========
总订单数: 1110
  - 已存在订单: 476
  - 新订单: 634
成功更新: 476
成功创建: 634
失败: 0
================================

✅ 订单导入工作流完成！
```

---

## 📝 注意事项

### 数据质量

- ✅ 确保 Excel 文件为 MA 系统导出的标准格式
- ✅ 确保"物流公司"列使用标准中文名称（与配置表一致）
- ✅ 确保日期格式正确（Excel 序列号或标准日期格式）

### 性能优化

- ✅ SKU 去重合并采用内存查找（避免重复查询数据库）
- ✅ 订单存在性检查采用分批查询（每批 100 条）
- ✅ 订单处理采用批量提交（每批 50 个）

### 测试阶段限制

- ⚠️ 当前处于测试阶段，采用严格模式
- ⚠️ 任何数据质量问题都会导致流程中断
- ⚠️ 建议在大批量导入前先备份数据库
- ⚠️ 可以先在小样本上测试

### 数据备份

- 💾 建议在大批量导入前先备份数据库
- 💾 可以先在小样本上测试流程

---

## 🔄 更新日志

### v5.5 (2026-10-24)
- ✅ 新增运单号保护机制：更新已存在订单时，先查询 `order_shipment` 表是否已存在运单号
- ✅ 如果 `order_shipment` 表中已存在运单号 → 只更新 `orders`、`order_pricing`、`order_items` 表，**不更新** `order_shipment` 表
- ✅ 如果 `order_shipment` 表中不存在运单号 → 新增 `order_shipment` 记录
- ✅ 新增 `checkShipmentExistence` 函数用于批量查询运单号存在性（CLI 脚本）
- ✅ 前端导入界面 (`/admin/upload/orders`) 同步更新，使用相同的运单号保护逻辑
- ✅ 前端导入结果新增显示跳过的物流记录数量

### v5.4 (2026-10-19)
- ✅ 新增作废订单运单状态同步规则：当 `order_status` 为 `cancelled` 且有运单号时，`order_shipment.shipment_status` 写入 `cancelled` 而非默认的 `created`
- ✅ CLI 脚本和前端导入接口同步更新

### v5.3 (2026-10-15)
- ✅ 金额字段保留原始精度：order_cny_value、order_ex_rate、sku_standard_price 不再强制保留固定小数位，导入文件中是几位小数就直接写入

### v5.2 (2026-10-15)
- ✅ 简化重复订单更新逻辑：遇到已存在订单时直接覆盖所有字段
- ✅ updateOrder 函数：更新所有字段（与 createOrder 一致），不再只更新部分字段
- ✅ updateOrderShipment 函数：删除旧物流记录后插入新记录，不再检查运单号冲突
- ✅ 移除运单号冲突报错逻辑

### v5.1 (2026-10-15)
- ✅ 移除 order_items 变更检测：更新已存在订单时直接删除旧 items 并插入新 items，不再调用 checkItemsChanged 比较
- ✅ 删除 checkItemsChanged 函数

### v5.0 (2026-10-15)
- ✅ 移除价格对比逻辑：导入文件中的 sku_standard_price 直接写入 order_items，不再与 sku.cny_price 对比
- ✅ 移除运单号前缀兜底识别：物流公司识别仅通过"物流公司"列查表，不再根据运单号前缀自动匹配
- ✅ 移除 TRACKING_NO_PREFIX_RULES 和 carrier_by_tracking 函数
- ✅ 增强 order_items 变更检测（后续版本移除）
- ✅ 修正物流公司映射：HH → HH EXPRESS（原 HH Express → HH EXPRESS）

### v4.0 (2026-10-14)
- ✅ 物流公司识别策略变更：从"物流渠道关键词匹配"改为"物流公司列中文名称直接查表"
- ✅ 删除数据库 carrier_enum 枚举类型，carrier 字段改为 TEXT
- ✅ 物流渠道直写：从"物流渠道"列直接读取写入 channel_id
- ✅ 新增 carrier-config.ts 作为物流公司全局配置源
- ✅ 物流公司中文名称更新：云途(新)、燕文物流(新)

### v3.0 (2026-10-14)
- ✅ 适配 orders 表拆分：orders（基本信息）+ order_pricing（价格信息）
- ✅ 新增作废时间回填规则、交运时间双写规则、退货标识映射规则

---

## 🧑‍💼 维护者

- **配置文件**: `tools/lib/admin/column-maps/ma-order-import-config.js`
- **主脚本**: `tools/import-ma-orders-from-xls.js`
- **工作流文档**: `workflow/ORDER_IMPORT_WORKFLOW_Latest1.md`

---

**最后更新**: 2026-10-16  
**文档状态**: ✅ 当前使用
