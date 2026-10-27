# 订单导入工作流文档

**版本**: 1.0  
**创建日期**: 2026-08-11  
**最后更新**: 2026-08-11  
**状态**: ✅ 已验证通过

---

## 📋 工作流概述

本工作流用于从 ERP 系统导出的订单 Excel 文件中自动导入订单数据到数据库，包括：
1. 同步最新 SKU 采购价
2. 解析和验证订单数据
3. 创建/更新订单记录
4. 价格对比分析
5. 生成执行报告

---

## 🎯 核心功能

### **步骤0: SKU 数据同步**
- **数据源**: `D:\WPSDrive\1207746729\WPS云盘\E-commerce共享\SKU文档\SKU_Price.xlsx`
- **读取方式**: 只读模式，不修改原文件
- **字段映射**:
  - `*库存sku编号` → `sku` (主键)
  - `库存sku英文名称` → `sku_name`
  - `标准采购价(RMB)` → `cny_price`
- **处理逻辑**:
  - 自动去重（使用 Map，保留最新值）
  - 批量 upsert（每批 500 条）
  - 价格保留 2 位小数
- **错误处理**: 任何错误立即中断流程

### **步骤1: 读取并验证 Excel 文件**
- **必需列** (18个):
  - 订单编号、店铺名、SKU、商品数量
  - 付款时间、交易编号、国家、订单状态
  - 是否重发订单、重发原因、订单总金额、汇率(原币)
  - 订单商品名称、商品编号(ItemId)、货运单号、交运时间
  - 物流渠道、物流公司
- **可选列** (2个):
  - 发货时间、最新采购价
- **验证规则**: 缺少必需列直接报错中断

### **步骤2: 解析数据并按订单分组**
- 按"订单编号"分组
- 同一订单的多个 SKU 行，其他字段取第一行
- 提取三类信息:
  - 订单基本信息 (orders)
  - 订单项信息 (order_items)
  - 运单信息 (order_shipment)

### **步骤3: 检查订单存在性**
- 查询数据库中已存在的订单
- 分为: 已存在订单、新订单

### **步骤4: 更新已存在订单**
- **orders 表**: 
  - 只在 Excel 中有 dispatch_date 时才更新
  - 更新字段: order_status, is_abnormal, abnormal_code, order_cny_value, order_ex_rate
- **order_items 表**:
  - 判断条件: SKU 列表或数量有任何变化
  - 更新策略: 删除所有旧记录，重新插入新记录
- **order_shipment 表**:
  - 一个订单只能有一个运单
  - tracking_no 冲突则报错
  - tracking_no 相同则更新 process_date, carrier, shipment_status

### **步骤5: 创建新订单**
- **创建顺序**: orders → order_items → order_shipment
- **shipment_status 初始值**: 'created'
- **process_date 格式**: YYYY-MM-DD HH:mm:ss
- **缺失运单号**: 跳过创建 order_shipment

### **步骤6: 价格对比分析**
- **时机**: 所有订单处理完后统一进行
- **对比对象**: Excel 中的 latest_cost vs sku.cny_price
- **NULL 处理**: 
  - latest_cost 为 NULL → 跳过对比，记录警告
  - sku.cny_price 为 NULL → 跳过对比，记录警告
  - SKU 不存在 → 报错中断（严格模式）
- **差异阈值**: 任何差异都记录（0%）

### **步骤7: 生成价格提醒文件**
- **输出文件**: `output/price-alerts.txt`
- **内容格式**:
  ```
  --- 记录 N ---
  订单编号: xxx
  SKU: xxx
  SKU表价格: xxx.xx
  最新采购价: xxx.xx
  差异: +xx.xx (+xx.xx%)
  ```

### **步骤8: 生成执行报告**
- **控制台输出**:
  - 总订单数、已存在订单数、新订单数
  - 成功更新数、成功创建数
  - 失败订单列表（如有）
  - 价格差异统计

---

## 🔒 错误处理策略（严格模式）

### **立即中断并回滚的情况**
1. ❌ Excel 列名缺失
2. ❌ SKU 在数据库中不存在
3. ❌ 店铺在 customer_store 表中找不到
4. ❌ 运单号重复（不同订单有相同 tracking_no）
5. ❌ 任何数据库操作失败
6. ❌ SKU_Price.xlsx 文件不存在或格式错误

### **继续处理但记录警告的情况**
1. ⚠️ latest_cost 为 NULL
2. ⚠️ sku.cny_price 为 NULL

### **单个订单失败的处理**
- 回滚该订单的所有操作
- 继续处理其他订单
- 最后在报告中列出失败订单

---

## 📂 文件结构

```
customer-portal/
├── workflow/                    # 工作流文档
│   └── ORDER_IMPORT_WORKFLOW.md
├── tools/                       # 工具脚本
│   ├── import-orders-from-excel.js        # 主脚本
│   ├── check-target-excel.js              # Excel 文件检查
│   ├── check-orders-before-import.js      # 订单存在性检查
│   ├── check-missing-sku.js               # SKU 缺失检查
│   ├── check-sku-folder.js                # SKU 文件夹检查
│   └── check-sku-price-file.js            # SKU_Price 文件检查
├── output/                      # 输出文件
│   └── price-alerts.txt         # 价格提醒报告
├── lib/admin/column-maps/       # 配置文件
│   └── order-import-config.js   # 订单导入配置
└── .env.local                   # 环境变量
```

---

## 🚀 使用方法

### **基本用法**
```bash
node tools/import-orders-from-excel.js <excel_file_path>
```

### **示例**
```bash
node tools/import-orders-from-excel.js "d:\Download\订单导出数据20260811203837-748103-621444511548551168.xlsx"
```

### **前置检查**
在执行导入前，建议先运行检查脚本：

1. **检查 Excel 文件格式**
   ```bash
   node tools/check-target-excel.js
   ```

2. **检查订单存在性**
   ```bash
   node tools/check-orders-before-import.js
   ```

3. **检查 SKU 缺失情况**
   ```bash
   node tools/check-missing-sku.js
   ```

---

## 📊 执行结果示例

### **成功执行输出**
```
=== 开始订单导入工作流 ===

🔄 步骤0: 更新 SKU 数据...
   正在读取 SKU_Price.xlsx...
   总记录数: 17687
   有效记录数: 17589（已去重）
   正在更新数据库...
   已更新: 17589/17589
   ✅ SKU 数据更新完成: 17589 条记录

📖 步骤1: 读取 Excel 文件...
   总记录数: 32
   列数: 20
   ✅ 列名验证通过

📊 步骤2: 解析数据并按订单分组...
   唯一订单数: 22

🔍 步骤3: 检查订单存在性...
   已存在订单: 22
   新订单: 0

🔄 步骤4: 更新已存在订单...
   成功更新: 22

💰 步骤6: 价格对比分析...
   发现 4 个价格差异

📝 步骤7: 生成价格提醒文件...
   文件已保存: output/price-alerts.txt

📋 步骤8: 生成执行报告...
========== 执行报告 ==========
总订单数: 22
  - 已存在订单: 22
  - 新订单: 0
成功更新: 22
成功创建: 0
价格差异: 4 个 SKU
================================

✅ 订单导入工作流完成！
```

---

## 🔧 配置说明

### **order-import-config.js**
位于 `lib/admin/column-maps/order-import-config.js`

#### **枚举值映射**
- **order_status**: 配货中→processed, 已发货→shipped, 待处理→received, 已作废→cancelled
- **carrier**: 燕文物流(新)→YANWEN, 云途(新)→YUNExpress, HH→HH EXPRESS, 雄九供应链→XJ LOGISTICS
- **abnormal_code**: 发错→wrong_item, 丢包→package_lost, 破损→damaged, etc.

#### **业务规则**
- DEFAULT_SHIPMENT_STATUS: 'created'
- PRICE_ALERT_THRESHOLD_PERCENT: 0 (任何差异都提醒)
- BATCH_SIZE: 50 (订单批量处理大小)

---

## ⚠️ 注意事项

### **测试阶段限制**
- 当前处于测试阶段，采用严格模式
- 任何数据质量问题都会导致流程中断
- 不允许 SKU 不存在、店铺映射缺失等情况

### **数据备份**
- 建议在大批量导入前先备份数据库
- 可以先在小样本上测试

### **性能优化**
- SKU 更新采用分批 upsert（每批 500 条）
- 订单处理采用批量提交（每批 50 个）
- 避免逐条查询数据库，使用内存查找表

---

## 📝 更新日志

### **v1.0 (2026-08-11)**
- ✅ 初始版本发布
- ✅ 支持 SKU 数据自动同步
- ✅ 支持订单创建和更新
- ✅ 支持价格对比分析
- ✅ 支持严格模式错误处理
- ✅ 自动生成价格提醒报告

---

## 🤝 维护者

- **配置文件**: `lib/admin/column-maps/order-import-config.js`
- **主脚本**: `tools/import-orders-from-excel.js`
- **工作流文档**: `workflow/ORDER_IMPORT_WORKFLOW.md`

---

**最后更新**: 2026-08-11  
**文档状态**: ✅ 已验证通过
