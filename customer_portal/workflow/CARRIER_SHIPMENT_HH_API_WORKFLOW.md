# 华翰物流 API 运单状态与尾程跟踪号查询工作流

**版本**: 1.4  
**创建日期**: 2026-10-17  
**最后更新**: 2026-11-03  
**状态**: ✅ 已验证

---

## 📋 工作流概述

本工作流用于通过华翰物流 API 批量查询 `order_shipment` 表中 HH EXPRESS 运单的物流状态和尾程跟踪号，并将结果回写到数据库。

### **核心逻辑**
1. **从数据库获取待查询运单**：
   - 先查询 `orders` 表中 `order_status = 'shipped'` 的所有 `transaction_id`
   - 再查询 `order_shipment` 表，筛选 `transaction_id` 在上述列表中，且 `carrier = 'HH EXPRESS'` 且 `shipment_status = 'created'` 且 `process_date` 在最近3个月内的运单
2. **调用 getCargoTrack API**：批量获取物流轨迹状态
3. **调用 getLastTrackCode API**：批量获取尾程跟踪号及派送商
4. **状态映射**：将华翰 API 状态码转换为数据库 `shipment_status` 枚举值
5. **回写数据库**：更新 `order_shipment` 表的 `shipment_status` 和 `dest_tracking` 字段；HHWUE 前缀特殊渠道无尾程号时写入 `NA`
6. **生成异常报告**：对无 dest_tracking 的记录生成异常文件

### **适用场景**
- **定期同步“已制单”运单的最新状态**：查询状态为 `created` 的运单，确认是否已实际揽收并发出
- **获取尾程派送跟踪号**：补充缺失的 dest_tracking 信息（如 USPS、GOFO、UNIUNI）
- **发现异常运单**：识别长期处于 `created` 状态但未实际发出的运单
- **避免重复查询**：仅查询 `created` 状态的运单，已 `shipped` 或 `cancelled` 的运单无需重复处理

---

## 🔧 前置条件

### **API 凭据**
| 项目 | 值 | 获取方式 |
|------|---|---------|
| API 账号 (appToken) | 见凭据文件 | 登录 hhddb.com → 登录 → API设置 → 添加 |
| API 密钥 (appKey) | 见凭据文件 | 同上 |
| API Endpoint | `http://api.hh-exp.com/default/svc/web-service` | 华翰 API 文档 |

> ⚠️ 凭据文件位置：`customer_portal/华翰API KEY.txt`

### **数据库访问**
- Supabase 连接信息见 `source/.env.local`
- 目标表：`order_shipment`

### **依赖环境**
- Node.js（支持 `fetch` API，Node 18+）
- `@supabase/supabase-js` 包（`tools/node_modules` 中已安装）

---

## 📡 API 接口说明

### **1. getCargoTrack — 查询物流轨迹**

**用途**：获取运单的最新物流状态和完整轨迹

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| codes | Array | 是 | 服务商单号（tracking_no）或系统运单号数组 |

**请求示例**：
```json
{ "codes": ["HHWPZ6213044701YQ", "HHWPZ6214013801YQ"] }
```

**响应字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| Code | string | 单号 |
| Country_code | string | 目的国家代码 |
| New_date | string | 最新轨迹时间 (YYYY-MM-DD HH:MM:SS) |
| New_Comment | string | 最新轨迹内容 |
| Status | string | 最新轨迹状态码 |
| Detail | Array | 轨迹明细（Occur_date, Status, Comment, track_area） |

**限制**：
- 建议 ≤20 票/次
- 不建议并发请求，建议 ≤5 req/s

### **2. getLastTrackCode — 获取尾程跟踪号**

**用途**：获取运单入库后的实际发货跟踪号及尾程派送商

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reference_no | Array | 是 | 客户单号或系统运单号数组 |

**请求示例**：
```json
{ "reference_no": ["HHWPZ6213044701YQ"] }
```

**响应字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| state | int | 1 成功 / 0 失败 |
| OrderNumber | string | 客户单号 |
| TrackingNumber | string | 尾程跟踪号（写入 dest_tracking） |
| providerCode | string | 尾程轨迹服务商代码（如 USPS、GOFO） |
| WayBillNumber | string | 系统运单号 |
| msg | string | 错误信息（失败时） |

**已知行为**：
- HHWUE 前缀运单属于特殊渠道，即使已妥投也不返回 dest_tracking
  - 回写时对该前缀且无尾程号的运单写入 `dest_tracking = 'NA'`（仅此特殊情况写 NA）
- IR 状态运单（仅电子信息未实际发出）不返回 dest_tracking

---

## 🔄 工作流程

### **步骤 1: 从数据库获取待查询运单**

```
查询 order_shipment 表
  └─ 筛选条件:
      ├─ carrier = 'HH EXPRESS'
      ├─ shipment_status = 'created'（仅查询状态为“已制单”的运单）
      └─ process_date >= 当前日期 - 3个月（仅查询最近3个月的运单）
  └─ 获取字段: tracking_no, transaction_id, process_date, dest_tracking
  └─ 分页: 每页 1000 条（Supabase 默认限制）
```

**查询逻辑说明**：
- **为什么只查询 `shipment_status = 'created'`**：
  - 状态为 `created` 的运单表示“已制单但未实际发出”
  - 这些运单可能已经实际揽收并发出，但数据库中状态未更新
  - 通过华翰API查询可以获取最新状态和尾程跟踪号
  - 状态为 `shipped` 或 `cancelled` 的运单无需重复查询

- **为什么限制 `process_date` 为3个月以内**：
  - 避免查询过于久远的历史数据
  - 3个月内的运单更可能处于流转状态，需要状态更新
  - 超过3个月的运单通常已妥投或取消，无需频繁查询

**SQL 查询示例**：
```sql
SELECT tracking_no, transaction_id, process_date, dest_tracking
FROM order_shipment
WHERE carrier = 'HH EXPRESS'
  AND shipment_status = 'created'
  AND process_date >= CURRENT_DATE - INTERVAL '3 months'
ORDER BY process_date DESC
```

**输出**：待查询的 tracking_no 列表（仅包含状态为 created 且最近3个月的运单）

### **步骤 2: 调用 getCargoTrack 获取物流状态**

```
将 tracking_no 列表按 20 条一批分组
  └─ 逐批调用 getCargoTrack API
  └─ 每批间隔 250ms（4 req/s，低于 5 req/s 限制）
  └─ 解析 SOAP XML 响应中的 JSON 数据
  └─ 构建 statusMap: { tracking_no → { status, latest_date, latest_comment, country } }
```

**输出**：所有运单的物流状态映射

### **步骤 3: 调用 getLastTrackCode 获取尾程跟踪号**

```
将 tracking_no 列表按 20 条一批分组
  └─ 逐批调用 getLastTrackCode API
  └─ 每批间隔 250ms
  └─ 仅保留 state = '1' 的成功记录
  └─ 构建 destMap: { tracking_no → { dest_tracking, provider_code } }
```

**输出**：运单号到尾程跟踪号的映射

### **步骤 4: 状态映射**

将华翰 API 状态码转换为数据库 `shipment_status` 枚举值：

| API 状态码 | 官方中文含义 | DB shipment_status | 说明 |
|-----------|------|-------------------|------|
| IR | 电子信息已收到 | `created` | 仅创建信息，未实际发出 |
| AF | 已入仓 | `shipped` | 到达始发设施 |
| DF | 已出仓 | `shipped` | 离开始发设施 |
| GG | 已过港 | `shipped` | 转运至始发机场 |
| BG | 已报关 | `shipped` | 出口清关完成 |
| AP | 已交航 | `shipped` | 始发机场收货 |
| QF | 已起飞 | `shipped` | 离开始发机场 |
| LD | 已落地 | `shipped` | 到达目的机场 |
| DR | 到达目的地 | `shipped` | — |
| QG | 清关中 | `shipped` | 进口清关开始 |
| YG | 已清关 | `shipped` | 进口清关完成 |
| JY | 已交邮 | `shipped` | 已交接本地承运商 |
| CA | 到达尾程承运商 | `shipped` | 到达末公里分拣中心 |
| CB | 离开尾程承运商 | `shipped` | 离开终端转运中心 |
| YQ | 已提取 | `shipped` | 到达分拣设施 |
| IA | 已上网 | `shipped` | Internet Access |
| WB | 到达中转站 | `shipped` | — |
| WD | 离开中转站 | `shipped` | — |
| PB | 到达待取 | `shipped` | — |
| ND | 运输中 | `shipped` | Normal delivery |
| CC | 派送妥投 | `shipped` | 已签收 |
| AC | 清关异常 | `shipped` | 清关异常 |
| AE | 清关失败 | `shipped` | 清关失败 |
| DS | 已丢失 | `shipped` | 包裹丢失 |
| FI | 签收失败 | `shipped` | 派送失败 |
| UE | 退件 | `shipped` | **例外**：UE + 末尾 Detail=AF → `returned` |
| UH | 海外退件 | `shipped` | — |
| NO | 新订单 | `created` | 兼容码，轨迹本质为 IR |
| AR | 已到达中转设施 | `shipped` | 兼容码 |
| DP | 已从中转设施发出 | `shipped` | 兼容码 |
| OD | 已派送 | `shipped` | 兼容码（新词表无「派送中」） |
| TD | 运输中 | `shipped` | 兼容码 |
| PD | 已签收 | `shipped` | 兼容码 |
| NA | 异常 | `shipped` | 兼容码 |
| FK | 异常/退回 | `shipped` | 兼容码 |
| RD | 已退件 | `shipped` | 兼容码 |
| CW / CN | 已取消 | `cancelled` | 兼容码 |
| DN | 未找到 | 不更新（`null`） | 兼容码，非业务状态 |

> 📌 映射规则以单一数据源 `source/lib/admin/carrier-configs/carrier-shipment-config.ts` 中的 `API_STATUS_MAP['HH EXPRESS']` 为准，CLI 通过生成的 `tools/lib/admin/carrier-configs/carrier-shipment-config.js` 使用同一份配置。

### **步骤 5: 回写数据库**

```
遍历所有 API 查询到的运单
  └─ 更新 order_shipment 表
      ├─ SET shipment_status = 映射后的状态值（必须更新）
      └─ SET dest_tracking = API 返回的 TrackingNumber（如果有）
  └─ 以 tracking_no 为匹配键
  └─ 逐条更新，记录成功/失败
```

**回写策略**：
- **所有查询到的运单都会更新 `shipment_status`**：因为这些运单原本状态都是 `created`，需要根据API返回的最新状态进行更新
- **如果有 `dest_tracking`，同时更新该字段**：API返回的 `TrackingNumber` 即为尾程跟踪号
- **如果API未返回 `dest_tracking`，不更新该字段**：保持原有值（通常为 NULL）
- **例外：HHWUE 前缀特殊渠道**：该前缀运单 API 永不返回尾程号，且库中 `dest_tracking` 为空时写入 `NA`；若库中已有值则保留。**只有 HHWUE 前缀会写 NA，其他无尾程号的运单仍保持不更新。**

**回写逻辑说明**：
- 由于查询条件限制为 `shipment_status = 'created'`，这些运单原本就没有实际发出
- API查询后，如果状态变为 `shipped`（已揽收/运输中/派送中/已签收等），说明运单已实际发出
- 如果状态仍为 `created`，说明运单仍未发出
- 如果状态变为 `cancelled`，说明运单已取消

**数据流转**：
```
查询前: shipment_status = 'created', dest_tracking = NULL（通常）
  ↓
API查询: 获取最新状态和尾程跟踪号
  ↓
回写后: shipment_status = 'shipped'/'created'/'cancelled'
        dest_tracking = '尾程单号'（如果有）
                        'NA'（HHWUE 前缀且无尾程号）
                        NULL（其他无尾程号的情况）
```

### **步骤 6: 生成异常报告与 CSV 导出**

```
导出完整查询结果 → CSV 文件
  └─ 路径: Data Import/HH_EXPRESS_<日期范围>_tracking.csv
  └─ 字段: tracking_no, transaction_id, order_date, store_name, country,
           status, latest_date, latest_comment, dest_tracking, provider_code, track_count

筛选无 dest_tracking 的记录 → 异常文件
  └─ 路径: Data Import/HH_EXPRESS_no_dest_tracking_<YYYYMMDD_HHmmss>.csv
  └─ 文件名包含时间戳，便于追溯
```

### **步骤 7: 数据验证**

```
读取 CSV 文件（数据源）
  └─ 查询数据库对应 tracking_no 的记录
  └─ 逐条比对 shipment_status 和 dest_tracking
  └─ 输出验证报告:
      ├─ 匹配率
      ├─ 不匹配记录明细
      ├─ 数据库完整性检查（NULL 值、空字符串等）
      └─ 抽样比对展示
```

---

## ⚠️ 异常处理策略

### **API 层面**

| 异常场景 | 处理策略 | 说明 |
|---------|---------|------|
| API 返回 `ask: "Failure"` | 记录失败批次，继续处理下一批 | 不中断整体流程 |
| SOAP XML 解析失败 | 返回 `{ ask: 'Failure' }`，计入错误 | 可能是网络超时 |
| 单号不存在 | API 返回空 Data，该单号无状态数据 | 记录为 NO_DATA |
| 请求频率超限 | 被 WAF 防火墙拦截 | 控制 ≤5 req/s |

### **数据层面**

| 异常场景 | 处理策略 | 说明 |
|---------|---------|------|
| 无 dest_tracking 返回 | 仍更新 shipment_status；HHWUE 前缀写 `dest_tracking = 'NA'`，其他前缀不更新 dest_tracking | HHWUE 前缀特殊渠道、IR 状态运单 |
| 数据库更新失败 | 记录错误信息，继续处理其他记录 | 逐条更新，单条失败不影响全局 |
| tracking_no 在数据库中不存在 | 跳过，不计入更新统计 | 可能是脏数据 |
| shipment_status 为 NULL | 不写入 status 字段，仅写入 dest_tracking | 避免 enum 校验错误 |
| 查询结果为空 | 记录日志，正常结束 | 表示没有符合条件的运单 |

### **网络层面**

| 异常场景 | 处理策略 | 说明 |
|---------|---------|------|
| 网络超时 | 捕获异常，记录失败批次 | 可重跑脚本覆盖 |
| Supabase 连接失败 | 立即中断并报错 | 检查网络连接和 API Key |

### **幂等性保证**
- 脚本可重复执行，后执行的结果会覆盖先前的结果
- 如果中途失败，修复问题后重新运行即可，不会造成数据重复

---

## 📊 华翰轨迹状态码完整参考

| 状态码 | 官方英文含义 | 官方中文含义 | DB 映射 |
|--------|---------|---------|---------|
| IR | Shipment information received | 电子信息已收到 | `created` |
| AF | Arrived at origin facility | 已入仓 | `shipped` |
| DF | Departed from origin facility | 已出仓 | `shipped` |
| GG | Transfer to Origin airport | 已过港 | `shipped` |
| BG | Export customs clearance completed | 已报关 | `shipped` |
| AP | Received by airport of Origin | 已交航 | `shipped` |
| QF | Departed from airport of Origin | 已起飞 | `shipped` |
| LD | Arrived at destination airport | 已落地 | `shipped` |
| DR | Destination Reached | 到达目的地 | `shipped` |
| QG | Import Customs clearance started | 清关中 | `shipped` |
| YG | Import Customs clearance completed | 已清关 | `shipped` |
| JY | Has been given to local carrier | 已交邮 | `shipped` |
| CA | arrived at last mile sorting center | 到达尾程承运商 | `shipped` |
| CB | Leaving the terminal transfer center | 离开尾程承运商 | `shipped` |
| YQ | Arrived at sort facility | 已提取 | `shipped` |
| IA | Internet Access | 已上网 | `shipped` |
| WB | Arrived at Transit Facility | 到达中转站 | `shipped` |
| WD | Departed from Transit Facility | 离开中转站 | `shipped` |
| PB | Arrival to be picked up | 到达待取 | `shipped` |
| ND | Normal delivery | 运输中 | `shipped` |
| CC | Delivered | 派送妥投 | `shipped` |
| AC | Abnormal customs clearance | 清关异常 | `shipped` |
| AE | Customs clearance failed | 清关失败 | `shipped` |
| DS | The package has been lost | 已丢失 | `shipped` |
| FI | Delivery failed | 签收失败 | `shipped` |
| UE | Untread Expresse | 退件 | `shipped`（UE+AF → `returned`） |
| UH | Overseas return | 海外退件 | `shipped` |

> 📌 上表为官方 `getCargoTrack` 状态码表（27 个）。`NO/AR/DP/OD/TD/PD/NA/FK/RD/CW/CN/DN` 为历史兼容码，映射见步骤 4。
>
> 📌 完整状态码图片见：`docs/hh_status_codes.png`、`docs/API接口文档/华翰api/uploads/mindoc/images/m_dda782192c155c0f4053a9980d2eeace_r.png`

---

## 📁 尾程派送商说明

| 派送商 | providerCode | 说明 | 典型 dest_tracking 格式 |
|--------|-------------|------|------------------------|
| USPS | `USPS` | 美国邮政 | 9214490...（20-30位数字） |
| GOFO | `GOFO` | GoFO 物流 | 以 UUS 开头 |
| UNIUNI | `UNIUNI` | 优你优你快递 | 以 UUS 开头 |

---

## 🛠️ 使用方法

### **批量查询并导出 CSV**
```bash
cd customer_portal/tools
node _query_hh_track_export.js
```

### **查询单个/多个运单**
```bash
cd customer_portal/tools
node _query_hh_single.js HHWPZ6213044701YQ
node _query_hh_single.js HHWPZ6213044701YQ HHWPZ6214013801YQ
```

### **回写数据库**
```bash
cd customer_portal/tools
node _writeback_hh.js
```

### **验证回写数据**
```bash
cd customer_portal/tools
node _verify_writeback.js
```

---

## 📋 输出文件

### **完整查询结果 CSV**
- **路径**: `Data Import/HH_EXPRESS_<日期范围>_tracking.csv`
- **字段**:

| 字段 | 来源 | 说明 |
|------|------|------|
| tracking_no | 数据库 | 华翰运单号 |
| transaction_id | 数据库 | 交易 ID |
| order_date | 数据库 (orders) | 订单日期 |
| store_name | 数据库 (orders) | 店铺名称 |
| country | getCargoTrack | 目的国家 |
| status | getCargoTrack | API 状态码 |
| latest_date | getCargoTrack | 最新轨迹时间 |
| latest_comment | getCargoTrack | 最新轨迹内容 |
| dest_tracking | getLastTrackCode | 尾程跟踪号 |
| provider_code | getLastTrackCode | 尾程派送商 |
| track_count | getCargoTrack | 轨迹总条数 |

### **异常记录文件**
- **路径**: `Data Import/HH_EXPRESS_no_dest_tracking_<YYYYMMDD_HHmmss>.csv`
- **内容**: 所有无 dest_tracking 的运单记录
- **用途**: 人工排查特殊渠道运单或未实际发出的运单

---

## 📊 生产数据记录

### **2026 年 8 月 HH EXPRESS 批量查询**

| 指标 | 数值 |
|------|------|
| 总运单数 | 581 |
| getCargoTrack 成功率 | 100%（581/581） |
| getLastTrackCode 成功率 | 97.8%（568/581） |
| 回写成功 | 568（100%） |
| 回写失败 | 0 |
| 异常记录 | 13（无 dest_tracking） |
| 验证匹配率 | 100.0% |

**状态分布**：

| 状态 | 数量 | 占比 |
|------|------|------|
| CC（妥投） | 572 | 98.5% |
| AF（到达） | 1 | 0.2% |
| FK（异常） | 2 | 0.3% |
| IR（信息收到） | 2 | 0.3% |
| ND（未投递） | 2 | 0.3% |
| UE（签收失败） | 1 | 0.2% |
| YG（其他） | 1 | 0.2% |

**尾程派送商分布**：

| 派送商 | 数量 | 占比 |
|--------|------|------|
| USPS | 318 | 55.9% |
| GOFO | 242 | 42.4% |
| UNIUNI | 8 | 1.4% |
| (无) | 13 | 2.3% |

---

## 🔍 异常运单分析

### **无 dest_tracking 的 13 条运单特征**

| 前缀 | 数量 | 特征 | 原因 |
|------|------|------|------|
| HHWUE | 11 | 特殊渠道运单 | 不走常规尾程换号流程，即使已妥投也无 dest_tracking |
| HHWYM | 1 | IR 状态 | 仅收到电子信息，未实际发出 |
| HHWPZ | 1 | IR 状态 | 仅收到电子信息，未实际发出 |

**处理策略**：
- HHWUE 前缀：标记为"特殊渠道"，无需处理
- IR 状态：持续跟踪，待状态变更后重新查询
- FK/UE 状态：联系华翰客服确认运单实际情况

---

## 🔗 与物流商运单导入工作流的关系

本工作流与 `CARRIER_SHIPMENT_IMPORT_WORKFLOW.md`（物流商运单导入工作流）是**互补关系**：

| 对比项 | 本工作流（API 查询） | 运单导入工作流（Excel 导入） |
|--------|-------------------|------------------------|
| **数据来源** | 华翰 API 实时查询 | 物流商导出的 Excel 文件 |
| **更新方式** | 主动拉取最新状态 | 被动接收物流商推送的数据 |
| **适用场景** | 需要实时状态、获取尾程跟踪号 | 物流商提供批量数据文件时 |
| **状态精度** | API 实时数据，最准确 | 依赖物流商导出时间点的快照 |
| **dest_tracking** | 通过 getLastTrackCode API 获取 | 从 Excel 的"跟踪号"列读取 |
| **更新目标** | 仅更新 order_shipment 表 | 仅更新 order_shipment 表 |

**推荐组合使用**：
1. 先用 **Excel 导入工作流** 快速批量更新基础状态
2. 再用 **API 查询工作流** 补充尾程跟踪号和验证状态准确性

---

## 📝 注意事项

### **API 调用限制**
- 每批 ≤20 票，建议请求频率 ≤5 req/s
- 不建议并发请求，可能被 WAF 防火墙拦截
- API endpoint 不可用于客户端登录（会导致登录异常）

### **数据库注意事项**
- `order_shipment` 表必须有对应的 tracking_no 记录才能更新
- `dest_tracking` 字段允许 NULL，兼容无尾程跟踪号的特殊情况
- `shipment_status` 为 TEXT 类型，值必须为合法枚举（created/shipped/cancelled/returned）

### **特殊运单前缀**
- HHWUE 前缀运单属于特殊渠道，getLastTrackCode 不返回 dest_tracking
- 这是正常行为，不是 API 错误
- 回写时该前缀且无尾程号的运单统一写入 `dest_tracking = 'NA'`，不再进入“无尾程号”异常文件

---

## 📂 相关文件

| 文件路径 | 说明 |
|---------|------|
| `tools/_query_hh_track_export.js` | 批量查询 API 并导出 CSV 的主脚本 |
| `tools/_query_hh_single.js` | 查询单个/多个运单的辅助脚本 |
| `tools/_writeback_hh.js` | 从 CSV 回写数据库的脚本 |
| `tools/_verify_writeback.js` | 验证回写数据正确性的脚本 |
| `tools/lib/admin/carrier-configs/carrier-shipment-config.js` | 物流商配置文件（状态映射，CLI 镜像） |
| `docs/华翰api/v1/` | 华翰 API 接口文档 |
| `docs/hh_status_codes.png` | 华翰轨迹状态码对照表 |
| `华翰API KEY.txt` | API 认证凭据 |
| `Data Import/HH_EXPRESS_Aug2026_tracking.csv` | 完整查询结果 |
| `Data Import/HH_EXPRESS_no_dest_tracking_*.csv` | 异常记录文件 |
| `workflow/CARRIER_SHIPMENT_IMPORT_WORKFLOW.md` | 物流商运单 Excel 导入工作流 |

---

## 📌 更新日志

### **v1.4 (2026-11-03)**
- ✅ 新增 HHWUE 特殊渠道回写规则：`getLastTrackCode` 无返回且库中 `dest_tracking` 为空时写入 `'NA'`（仅该前缀生效）
- ✅ 同步修改 `tools/workflow_hh_created.js`（手工工作流）与 `tools/scheduler/hh-scheduler-core.js`（每日定时任务）
- ✅ 异常文件不再包含 HHWUE 前缀运单（已通过 NA 标记）

### **v1.3 (2026-11-03)**
- ✅ 以官方状态码表为准重写 `API_STATUS_MAP['HH EXPRESS']` / `API_STATUS_DESC['HH EXPRESS']`（单一数据源：`source/lib/admin/carrier-configs/carrier-shipment-config.ts`）
- ✅ 修正错误口径：`CC` 派送妥投（原误映射为「已预报」）、`CA` 到达尾程承运商（原误按「已取消」）、`QF` 已起飞、`LD` 已落地、`AP` 已交航、`BG` 已报关、`YG` 已清关
- ✅ `UE` 退件，`FI` 签收失败、`AC/AE` 清关异常/失败、`DS` 已丢失 归入 `shipped`；`CW/CN` 已取消 → `cancelled`
- ✅ 保留历史兼容码 `NO/AR/DP/OD/TD/PD/NA/FK/RD`，新增通用「异常」键承载 `NA/FK`；`DN`（未找到）返回 `null`，不写 `shipment_status`
- ✅ 同步重新生成 CLI 镜像 `tools/lib/admin/carrier-configs/carrier-shipment-config.js`
- ✅ 手动工作流 `tools/workflow_hh_created.js` 移除本地 `STATUS_MAP`，改用共享配置 `mapApiStatus()`，与定时任务使用同一份映射

### **v1.2 (2026-10-30)**
- ✅ 添加 UE 状态条件映射：当 API 状态=UE 且末尾 Detail 节点=AF（Arrived at origin facility，长期停滞到仓件）时，映射为 `returned` 而非 `shipped`
- ✅ 更新步骤4状态映射表：UE 行增加条件映射说明
- ✅ 更新步骤5回写逻辑：UE+AF 记录即使没有 dest_tracking 也会更新 shipment_status
- ✅ 与燕文 SC38、云途 R 的条件映射保持一致的设计模式

### **v1.1 (2026-10-19)**
- ✅ 更新查询逻辑：仅查询 `shipment_status = 'created'` 且 `process_date` 在最近3个月内的运单
- ✅ 更新核心逻辑和适用场景说明
- ✅ 更新步骤1：添加详细的查询条件说明和SQL示例
- ✅ 更新步骤5：明确回写策略，所有查询到的运单都更新 `shipment_status`
- ✅ 更新异常处理策略：无 `dest_tracking` 返回时仍更新 `shipment_status`
- ✅ 与燕文工作流保持一致的查询和回写逻辑

### **v1.0 (2026-10-17)**
- ✅ 初始版本发布
- ✅ 覆盖完整工作流：API 查询 → 状态映射 → 数据库回写 → 异常处理 → 数据验证
- ✅ 基于 581 条 HH EXPRESS 运单实际验证
- ✅ 包含生产数据记录和异常分析
- ✅ 与物流商运单导入工作流的对比说明

---

**最后更新**: 2026-11-03  
**维护者**: Lingma AI Assistant  
**文档状态**: ✅ 已创建并验证



---

## 🚀 性能优化记录

### **v1.0 初始版本（逐条串行）**

| 指标 | 数值 |
|------|------|
| 方式 | 逐条串行 UPDATE |
| HTTP 请求 | 568 次串行 |
| 耗时 | ~120 秒 |
| 吞吐量 | ~4.7 条/秒 |

### **v1.1 并发优化（当前版本）**

| 指标 | 数值 |
|------|------|
| 方式 | Promise.all 并发（50 并发/批） |
| HTTP 请求 | 568 次，分 12 批并发 |
| 耗时 | **9.8 秒** |
| 吞吐量 | **58 条/秒** |
| 性能提升 | **约 12 倍** |
| 验证匹配率 | 100.0% |

### **未来升级：RPC 批量更新（需手动部署）**

当数据量进一步增长（数千条以上），可升级为 RPC 单次调用模式。

**部署步骤**：
1. 登录 Supabase Dashboard → SQL Editor
2. 执行以下 SQL：

```sql
CREATE OR REPLACE FUNCTION bulk_update_shipments(p_data JSON)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
  v_item JSON;
BEGIN
  FOR v_item IN SELECT * FROM json_array_elements(p_data) LOOP
    UPDATE order_shipment
    SET
      shipment_status = COALESCE(
        (v_item->>'shipment_status')::TEXT,
        shipment_status
      ),
      dest_tracking = COALESCE(
        v_item->>'dest_tracking',
        dest_tracking
      ),
      updated_at = NOW()
    WHERE tracking_no = v_item->>'tracking_no';

    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;
```

3. 部署后修改脚本调用方式：

```javascript
// 一次 RPC 调用更新全部记录
var rpcData = withDest.map(function(rec) {
  return {
    tracking_no: rec.tracking_no,
    dest_tracking: rec.dest_tracking,
    shipment_status: mapStatus(rec.status) || 'shipped'
  };
});

var { data, error } = await supabase.rpc('bulk_update_shipments', {
  p_data: JSON.stringify(rpcData)
});
```

**RPC 方案预期性能**：

| 指标 | 当前（并发） | RPC（预期） |
|------|------------|------------|
| HTTP 请求 | 12 批 | **1 次** |
| 耗时 | 9.8 秒 | **~2-3 秒** |
| 事务保证 | 无 | **有（原子操作）** |

> 📌 Migration 文件已就绪：`database-migrations/add-bulk-update-shipments-function.sql`
