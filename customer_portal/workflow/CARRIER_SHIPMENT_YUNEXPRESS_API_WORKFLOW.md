# 云途物流 API 运单状态与尾程跟踪号查询工作流

**版本**: 1.1  
**创建日期**: 2026-10-19  
**最后更新**: 2026-10-30  
**状态**: ✅ 已验证

---

## 📋 工作流概述

本工作流用于通过云途物流（YunExpress）开放平台 API 批量查询 `order_shipment` 表中 YUNExpress 运单的物流状态和尾程跟踪号，并将结果回写到数据库。

### **核心逻辑**
1. **从数据库获取待查询运单**：
   - 先查询 `orders` 表中 `order_status = 'shipped'` 的所有 `transaction_id`
   - 再查询 `order_shipment` 表，筛选 `transaction_id` 在上述列表中，且 `carrier = 'YUNExpress'` 且 `shipment_status = 'created'` 且 `process_date >= 当前日期 - 3个月` 的运单
2. **获取 accessToken**：OAuth2.0 `client_credentials` 模式换取令牌，缓存 2 小时
3. **调用轨迹查询 API**：逐单获取 `package_status` 与尾程跟踪号
4. **调用尾程信息 API**：批量（≤20 个/次）补齐尾程派送商代码、名称、查询站点
5. **状态映射**：经 `carrier-shipment-config` 的 `mapApiStatus()` 把云途状态码转换为数据库 `shipment_status` 枚举值
6. **回写数据库**：更新 `order_shipment` 的 `shipment_status` 和 `dest_tracking`，写后立即读回校验
7. **数据验证**：独立脚本做 API × DB × 快照 三方交叉核验

### **适用场景**
- **定期同步运单最新状态**：确认 `created` 运单是否已实际交运、`shipped` 运单是否已妥投
- **获取尾程派送跟踪号**：补充缺失的 `dest_tracking`（本批覆盖 Royal Mail、DHL、DPD、INPOST、Evri、Gofo 等 20 家尾程商）
- **发现异常运单**：识别 `E 可能异常` / `R 包裹退回` / `C 订单取消` 的运单
- **避免重复查询**：已妥投（`D`）且 `dest_tracking` 已落库的运单无需重复处理

### **与其他物流商工作流的差异**
| 维度 | 华翰 HH EXPRESS | 燕文 YANWEN | **云途 YUNExpress** |
|---|---|---|---|
| 鉴权方式 | API 账号 + 密码 | 用户 ID + TOKEN | **OAuth2 换 token + HmacSHA256 逐请求签名** |
| 令牌有效期 | 无令牌概念 | 长期 TOKEN | **7200 秒，需缓存与刷新** |
| 轨迹接口 | getCargoTrack | 单一轨迹接口 | **GET /v1/track-service/info/get（单条）** |
| 尾程号来源 | getLastTrackCode 独立接口 | 轨迹接口内返回 | **两个来源：轨迹接口 `track_Info.tracking_number` + POST /v1/order/last-mile/get（批量）** |
| 状态码形态 | 字母码（IR/CC/AF…） | 分段码（OR*/PU*/LM*…） | **单字母码（N/F/T/D/E/R/C）** |
| 状态映射位置 | 脚本内私有表 | 脚本内私有表 | **统一收敛到 carrier-shipment-config（单一数据源）** |

---

## 🔧 前置条件

### **API 凭据**
| 项目 | 值 | 获取方式 |
|------|---|---------|
| 客户代码 | 见凭据文件 | 云途提供 |
| APPID | 见凭据文件 | 云途开放平台控制台 → 应用管理 |
| APP 密钥 | 见凭据文件 | 云途开放平台控制台 → 应用管理 |
| sourceKey | 见凭据文件 | 控制台 → 用户中心 → 用户信息 |
| 生产 Endpoint | `https://openapi.yunexpress.cn` | 云途 API 文档 |
| 沙盒 Endpoint | `https://openapi-sbx.yunexpress.cn` | 云途 API 文档 |

> 🔑 凭据文件位置：`customer_portal/云途API KEY.txt`

### **数据库访问**
- Supabase 连接信息见 `source/.env.local`（脚本自动读取 `NEXT_PUBLIC_SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`）
- 目标表：`order_shipment`
- ⚠️ 该表**只有 7 列**：`tracking_no`、`transaction_id`、`process_date`、`shipment_status`、`carrier`、`channel_id`、`dest_tracking`。**没有** `id`、`updated_at`、`shipment_date`，`select` 写多会报 `42703 column does not exist`

### **依赖环境**
- Node.js 18+（脚本使用内置 `fetch`）
- `@supabase/supabase-js`（`tools/node_modules` 中已安装）
- Node 内置 `crypto`（HmacSHA256 签名）

---

## 📡 API 接口说明

### **0. OAuth2.0 获取 accessToken**

```http
POST https://openapi.yunexpress.cn/openapi/oauth2/token
Content-Type: application/json

{
  "grantType": "client_credentials",
  "appId": "{APPID}",
  "appSecret": "{APP密钥}"
}
```

响应：

```json
{ "expiresIn": 7200, "accessToken": "<JWT>" }
```

**关键要点**
- `grantType` 固定为 `client_credentials`
- `sourceKey` 是**可选字段**：整体省略可正常换取 token；**一旦传值就会被校验**，传错报 `0200412101`（应用 id 或应用秘钥错误）、HTTP 412
- 令牌有效期 7200 秒，须缓存复用，并在到期前 60 秒主动刷新
- 从 JWT payload 可解出 `customerCode`，用于确认令牌归属

### **1. 公共请求头与签名算法**

所有业务接口都必须携带三个请求头：

| 请求头 | 说明 |
|---|---|
| `token` | 上一步取得的 accessToken |
| `date` | **毫秒级**时间戳，与服务端偏差须在 300 秒内 |
| `sign` | 签名值，算法见下 |

签名内容拼接（字段名固定顺序、`&` 分隔，**字段名本身也要参与拼接**）：

```
# 有请求体（POST）
body={"waybill_numbers":["YT..."]}&date=1651049235123&method=POST&uri=/v1/order/last-mile/get

# 无请求体（GET）
date=1651049235123&method=GET&uri=/v1/track-service/info/get?order_number=YT2601500702042464
```

签名计算：

```
sign = Base64( HmacSHA256( content, appSecret ) )
```

**踩坑要点**
- `uri` 必须与实际请求 URI **完全一致**：GET 含 query 就要带上 query；POST 无 query 时**不能带尾部 `?`**，否则报 `0200401102`（访问签名无效或已过期）
- `body` 必须是实际发送的**原始字符串**，`JSON.stringify` 的键顺序不能变
- 收到 `0200401002` / `0200401102` 应刷新 token 后重试

### **2. GET /v1/track-service/info/get — 查询物流轨迹（单条）**

| 项目 | 值 |
|---|---|
| 接口标记 | `single`（单条查询，不支持批量） |
| 请求参数 | query `order_number`，长度 1–50 |
| 支持单号类型 | 云途运单号 / 客户单号 / 跟踪号 |

响应关键字段：

| 字段 | 说明 |
|---|---|
| `package_status` | 包裹状态码，见「云途包裹状态码完整参考」 |
| `track_Info.tracking_number` | **尾程跟踪号** |
| `track_Info.track_events[]` | 轨迹事件数组（`track_time` / `track_node` / `track_content` / `track_location`） |
| `product_name` | 渠道名称 |
| `channel_code` | 渠道代码 |
| `destination_code` | 目的国二字码 |
| `check_out_time` | 交运时间 |

### **3. POST /v1/order/last-mile/get — 批量获取尾程信息**

| 项目 | 值 |
|---|---|
| 接口标记 | `batch`（**单次最多 20 个运单号**） |
| 请求体字段 | **`waybill_numbers`**（字符串数组） |

```json
{ "waybill_numbers": ["YT2601500702042464", "YT2601500701870139"] }
```

响应：`result.carriers[]`，每项含 `waybill_number`、`tracking_number`、`last_mile_code`、`last_mile_name`、`last_mile_site`、`phone_number`。

**踩坑要点**
- 请求体字段名必须是 `waybill_numbers`。试过的 `order_number` / `order_numbers` / `tracking_numbers` / `serve_numbers` 全部报 `02039310`（运单号不能为空）
- 该接口比轨迹接口多提供 `last_mile_code` / `last_mile_name` / `last_mile_site`，用于报表展示尾程派送商

### **4. 常用错误码**

| 错误码 | 含义 | 处理方式 |
|---|---|---|
| `0200412101` | 应用 id 或应用秘钥错误（含 sourceKey 传错） | 检查凭据；`sourceKey` 建议整体省略 |
| `0200401002` | token 无效或已过期 | 刷新 token 后重试 |
| `0200401102` | 访问签名无效或已过期 | 检查 `uri` 是否与实际请求完全一致、`date` 是否毫秒、签名内容拼接顺序 |
| `02039310` | 运单号不能为空 | last-mile 接口请求体字段名应为 `waybill_numbers` |
| `02039301` | 订单不存在 | 该单号在云途侧查不到，`package_status` 返回 `N` |

---

## 🔄 工作流程

### **步骤 1: 从数据库获取待查询运单**

```
查询 order_shipment 表
  └─ 筛选条件:
      ├─ carrier = 'YUNExpress'
      ├─ shipment_status = 'created'（仅查询状态为"已制单"的运单）
      └─ process_date >= 当前日期 - 3个月（仅查询最近3个月的运单）
  └─ 获取字段: tracking_no, transaction_id, process_date, shipment_status, carrier, channel_id, dest_tracking
  └─ 排序: process_date DESC, tracking_no ASC
  └─ 分页: 每页 1000 条（Supabase 默认限制）
```

**查询逻辑说明**：
- **为什么只查询 `shipment_status = 'created'`**：
  - 状态为 `created` 的运单表示"已制单但未实际发出"
  - 这些运单可能已经实际揽收并发出，但数据库中状态未更新
  - 通过云途 API 查询可以获取最新状态和尾程跟踪号
  - 状态为 `shipped` 或 `cancelled` 的运单无需重复查询

- **为什么限制 `process_date` 为 3 个月以内**：
  - 避免查询过于久远的历史数据
  - 3 个月内的运单更可能处于流转状态，需要状态更新
  - 超过 3 个月的运单通常已妥投或取消，无需频繁查询

**SQL 查询示例**：
```sql
SELECT tracking_no, transaction_id, process_date, shipment_status, carrier, channel_id, dest_tracking
FROM order_shipment
WHERE carrier = 'YUNExpress'
  AND shipment_status = 'created'
  AND process_date >= CURRENT_DATE - INTERVAL '3 months'
ORDER BY process_date DESC, tracking_no ASC
```

> ⚠️ `select` 列表**不能包含 `id`**，该表没有主键列暴露出来，否则报 `42703`。

**输出**：待查询的 tracking_no 列表（仅包含状态为 created 且最近 3 个月的运单）

### **步骤 2: 获取并缓存 accessToken**

```js
let tokenCache = { token: null, expireAt: 0 };

async function getAccessToken() {
  // 提前 60 秒刷新，避免请求途中过期
  if (tokenCache.token && Date.now() < tokenCache.expireAt - 60000) return tokenCache.token;

  const resp = await fetch(YUN_HOST + '/openapi/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 注意：sourceKey 字段整体省略；传值会被校验，传错报 0200412101
    body: JSON.stringify({
      grantType: 'client_credentials',
      appId: YUN_APP_ID,
      appSecret: YUN_APP_SECRET,
    }),
  });
  const json = await resp.json();
  if (!json.accessToken) throw new Error('获取 accessToken 失败: HTTP ' + resp.status);
  tokenCache = { token: json.accessToken, expireAt: Date.now() + (json.expiresIn || 7200) * 1000 };
  return tokenCache.token;
}
```

65 条运单全程只换取 1 次 token（有效期 2 小时远大于查询耗时）。

### **步骤 3: 签名并调用轨迹查询 API**

```js
async function signedRequest(method, uri, bodyObj) {
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : null;
  for (let attempt = 1; attempt <= RETRY_TIMES; attempt++) {
    const token = await getAccessToken();
    const date  = String(Date.now());                       // 毫秒时间戳
    const content = bodyStr
      ? 'body=' + bodyStr + '&date=' + date + '&method=' + method + '&uri=' + uri
      : 'date=' + date + '&method=' + method + '&uri=' + uri;
    const sign = hmac(content, YUN_APP_SECRET);             // Base64(HmacSHA256(content, appSecret))

    const opts = { method, headers: { 'Content-Type': 'application/json', token, date, sign } };
    if (bodyStr) opts.body = bodyStr;
    const resp = await fetch(YUN_HOST + uri, opts);
    const json = await resp.json();

    // 令牌或签名失效：刷新 token 后重试
    if (['0200401002', '0200401102'].includes(json.code)) { tokenCache = { token: null, expireAt: 0 }; continue; }
    // 服务端 5xx：指数退避重试
    if (resp.status >= 500) { await sleep(500 * attempt); continue; }
    return json;
  }
}
```

调用轨迹接口（GET，uri 必须带 query）：

```js
const uri = '/v1/track-service/info/get?order_number=' + encodeURIComponent(trackingNo);
const json = await signedRequest('GET', uri, null);
```

并发控制采用**游标式 worker pool**（5 路并发），比 `Promise.all` 全量并发更稳，不会瞬时打爆频控：

```js
async function runPool(items, worker, concurrency) {
  let cursor = 0;
  await Promise.all(new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (cursor < items.length) { await worker(items[cursor++]); }
  }));
}
```

### **步骤 4: 批量获取尾程派送商信息**

```js
for (let i = 0; i < waybills.length; i += LASTMILE_BATCH) {
  const chunk = waybills.slice(i, i + LASTMILE_BATCH);      // ≤ 20 个
  // POST 无 query，uri 不能带尾部 '?'，否则签名报 0200401102
  const json = await signedRequest('POST', '/v1/order/last-mile/get', { waybill_numbers: chunk });
  (json.result?.carriers || []).forEach(c => { lastMileMap[c.waybill_number] = c; });
}
```

### **步骤 5: 状态映射（单一数据源）**

**不在脚本里维护私有映射表**，统一取自配置文件：

```js
const CFG = require('./lib/admin/column-maps/carrier-shipment-config.js');

CFG.mapApiStatus('YUNExpress', 'D');        // -> 'shipped'
CFG.getApiStatusDesc('YUNExpress', 'D');    // -> '投递成功'
```

映射采用**二级翻译**，避免出现第二套规则：

```
API package_status  →  API_STATUS_MAP 中文状态名  →  SHIPMENT_STATUS_MAP DB 枚举
        D            →        已签收              →      shipped
```

配置文件位置：
- 单一数据源（唯一可手工编辑）：`source/lib/admin/column-maps/carrier-shipment-config.ts`
- CLI 镜像（**自动生成，禁止手工编辑**）：`tools/lib/admin/column-maps/carrier-shipment-config.js`
- 生成器：`tools/lib/admin/column-maps/generate-carrier-config-mirror.js`

改完 `.ts` 后执行：

```powershell
node ./customer_portal/tools/lib/admin/column-maps/generate-carrier-config-mirror.js
```

### **步骤 6: 回写数据库**

脚本 `tools/_yun_writeback.js`，**默认 dry-run**，加 `--write` 才落库：

```powershell
node _yun_writeback.js                                    # 只看差异，不改库
node _yun_writeback.js --write                            # 实际回写
node _yun_writeback.js --write --only=YT2601500702042464  # 只回写指定运单
node _yun_writeback.js --json=<文件名>                     # 指定数据源
```

五条硬性安全规则：

| # | 规则 | 目的 |
|---|---|---|
| 1 | 只处理 `query_ok === 'Y'` 的记录 | API 查询失败的数据不得污染库 |
| 2 | `dest_tracking` 仅在 API 返回**非空**时写入 | 绝不用空值覆盖库中已有值 |
| 3 | `shipment_status` 仅在 `mapApiStatus()` 返回**非 null** 时写入 | 遵循「未映射状态安全处理规则」 |
| 4 | 匹配需 `tracking_no` + `carrier` + `process_date` 三条件，且影响行数**恰为 1** | 防止误伤同名运单 / 批量误更新 |
| 5 | 状态值由配置**实时推导**，不信任 JSON 里的预算值；不一致时告警并以配置为准 | 防止数据源过期导致写错 |

写入采用 `Promise.all` 并发 **50/批**（与 `import-carrier-shipments.js`、`_writeback_hh.js` 一致），每条 UPDATE 追加 `.select()` **写后读回**，逐字段核对期望值，并额外校验未写入字段没被意外改动：

```js
const { data, error } = await supabase.from('order_shipment')
  .update(patch)
  .eq('tracking_no', tno).eq('carrier', CARRIER).eq('process_date', PROCESS_DATE)
  .select('tracking_no, shipment_status, dest_tracking');

if (data.length !== 1) throw new Error('影响行数异常: ' + data.length);
Object.keys(patch).forEach(f => {
  if (data[0][f] !== patch[f]) throw new Error('读回值与期望不符: ' + f);
});
```

### **步骤 7: 数据验证**

脚本 `tools/_yun_verify_writeback.js` 做**三方交叉核验**（API JSON × 数据库 × 回写前快照），不复用回写脚本自己的结论：

| 检查项 | 内容 |
|---|---|
| 1 | `dest_tracking`：DB vs API 逐条比对，输出匹配率 |
| 2 | `shipment_status`：DB vs `mapApiStatus(API 码)` 逐条比对，输出匹配率 |
| 3 | 完整性：无 NULL/空 `shipment_status`、无 NULL/空 `dest_tracking`、状态值必须在 `created/shipped/cancelled` 内 |
| 4 | 唯一性：`tracking_no` 无重复 |
| 5 | 无误伤：快照 vs 当前，7 个字段全部逐条比对，确认只有预期字段变化 |

> 快照默认路径为 `Data Import/Process Log/YUNEXPRESS_snapshot_before_<process_date>.json`，
> 也可用 `--snapshot=<路径>` 显式指定；文件不存在时自动跳过检查 5（其余 4 项照常执行）。

发现问题时 `exitCode = 1`，可直接接入 CI 或批处理判断。

---

## ⚠️ 异常处理策略

### **API 层面**
| 情况 | 处理 |
|---|---|
| `0200401002` / `0200401102` | 清空 token 缓存，刷新后重试（最多 3 次） |
| `0200412101` | 凭据或 `sourceKey` 错误，中止并提示检查凭据文件 |
| `02039301` 订单不存在 | 记录 `query_ok = 'N'` + 错误码，该单**不回写** |
| `package_status = 'N'` | `mapApiStatus` 返回 null，**跳过 `shipment_status` 更新**（不代表任何业务状态） |
| 未收录状态码 | 同样返回 null 并跳过，报表中标记 `(未收录)`，提示补充配置 |

### **数据层面**
| 情况 | 处理 |
|---|---|
| API 未返回 `tracking_number` | 跳过 `dest_tracking`，保留库中原值，写入异常清单 |
| 库中无该 `tracking_no` | 跳过并告警，不新建记录 |
| 影响行数 ≠ 1 | 判为失败并记录，不静默通过 |
| 读回值与期望不符 | 判为失败并记录（可能是触发器改写了值） |

### **网络层面**
- 5xx 错误：指数退避重试（500ms × 尝试次数）
- 请求间隔 `DELAY_MS = 120ms`，避免触发频控
- 轨迹接口并发上限 5，last-mile 接口单批上限 20（API 硬限制）

### **幂等性保证**
- 回写前逐条比对库中现值，**只提交有实际差异的字段**；全一致时提交 0 条 UPDATE
- 同一份 JSON 重复执行 `--write` 结果一致，不会产生副作用
- 默认 dry-run，误执行不会改库

---

## 📊 云途包裹状态码完整参考

`GET /v1/track-service/info/get` 返回的 `package_status` 只有 7 个取值，粒度**比 Excel 导出更粗**（云途 API 无「已揽收 / 已发货 / 派送中 / 已删除」等中间态）。

| 码 | 官方英文释义 | 中文释义 | `API_STATUS_MAP` 中文名 | `SHIPMENT_STATUS_MAP` → DB 枚举 | 业务含义 |
|---|---|---|---|---|---|
| `N` | Order not found | 订单未找到 | **`null`** | **不更新** | 云途侧查无此单，非业务状态，**严禁写入 `shipment_status`** |
| `F` | Electronic forecast information reception | 已接收电子预报 | 已预报 | `created` | 仅完成预报，尚未实际揽收 |
| `T` | In transit | 运输中 | 运输中 | `shipped` | 已交运，在途 |
| `D` | Successful delivery | 投递成功 | 已签收 | `shipped` | 已妥投（终态） |
| `E` | May be abnormal | 可能异常 | 异常 | `shipped` | 需人工关注的异常件 |
| `R` | Package returned | 包裹退回 | 已退件 | `returned` | 退件签收（终态）✅ |
| `C` | Order Cancellation | 订单取消 | 已取消 | `cancelled` | 取消（终态） |

> **R 状态码说明**：云途 API 的 `package_status = 'R'` 涵盖"退回"和"弃件"两种场景，统一映射为 `returned`（退件签收完成，进入退货核查流程）。
>
> 配置位置：`carrier-shipment-config.ts` 的 `API_STATUS_MAP['YUNExpress']` 与 `API_STATUS_DESC['YUNExpress']`。
>
> **扩展方式**：云途新增状态码时，只需在这两个对象各加一条；若中文名已在 `SHIPMENT_STATUS_MAP['YUNExpress']` 中存在，无需改动其他任何代码。
>
> **Excel 专有状态**：`SHIPMENT_STATUS_MAP['YUNExpress']` 中的「已揽收 / 已发货 / 派送中 / 已删除」来自云途后台 Excel 导出，API 不会返回，属正常现象，无需反向映射。

### **映射安全规则**

```js
mapApiStatus(carrier, apiCode)
  ├─ apiCode 为空            → null
  ├─ 物流商未配置            → null
  ├─ 状态码未收录            → null   （报表标记「(未收录)」）
  ├─ 映射值为 null（如 N）   → null   （报表标记「(无业务状态)」）
  └─ 正常                    → created / shipped / cancelled
```

**返回 null 时调用方必须跳过 `shipment_status` 字段的更新**，绝不能写 null 或猜测默认值。

---

## 📁 尾程派送商说明

尾程信息由 `POST /v1/order/last-mile/get` 提供，本批 65 条实测覆盖 20 家尾程商：

| 尾程代码 | 尾程名称 | 条数 | 目的国 |
|---|---|---|---|
| `SP0281` | 英国 INPOST | 10 | GB |
| `DEDHL-INTL` | 德国 DHL INTL | 8 | DE |
| `DEDPD` | 德国 DPD | 7 | DE |
| `SP0134` | 爱尔兰 邮政 | 6 | IE |
| `SP1600` | 美国 Gofo | 6 | US |
| `UK-HERMES SORT` | 英国 Evri 预分拣 | 5 | GB |
| `AT-ATPOST` | 奥地利邮政 | 3 | AT |
| `DEDHLS` | 德国 DHL 预分拣 | 3 | DE |
| `UK-RM` | 英国 Royal Mail | 2 | GB |
| `SP1844` | 澳大利亚 SPEEDX | 2 | AU |
| `SP0656` | 加拿大 Intelcom | 2 | CA |
| `SP1695` | 瑞士-NOVA | 2 | CH |
| `JFK OSM` | JFK OSM | 2 | US |
| `CAPOST` | 加拿大邮政 | 1 | CA |
| `PARCEL POST` | 澳大利亚 Parcel Post | 1 | AU |
| `ORD USPS FC` | ORD USPS FC | 1 | US |
| `DFW OSM` | DFW OSM | 1 | US |
| `GR-DPD` | 希腊 DPD | 1 | GR |
| `SP1647` | 加拿大 Emile | 1 | CA |
| `SG-JT` | 新加坡极兔 | 1 | SG |

**目的国分布**：DE 18 / GB 17 / US 10 / IE 6 / CA 4 / AU 3 / AT 3 / CH 2 / GR 1 / SG 1

> `last_mile_site` 字段提供各尾程商的官方查询网址，可直接用于前端「尾程跟踪」跳转链接。
>
> 轨迹接口返回的 `track_Info.tracking_number` 与 last-mile 接口返回的 `tracking_number` 在本批 65 条中**完全一致**，两者可互为校验。

---

## 🛠️ 使用方法

### **完整流程（查询 → 回写 → 验证）**

```powershell
cd customer_portal/tools

# 1. 查询 API，产出 JSON + CSV
node _yun_query_batch.js

# 2. dry-run 看差异（不落库，安全）
node _yun_writeback.js

# 3. 确认差异无误后执行回写
node _yun_writeback.js --write

# 4. 独立验证（有问题 exitCode = 1）
node _yun_verify_writeback.js
```

### **只处理指定运单**

```powershell
node _yun_writeback.js --write --only=YT2601500702042464,YT2601500701870139
```

### **换批次 / 换数据源**

- 换批次：无需修改代码（自动滚动 3 个月窗口）；如需调整窗口范围，修改三个脚本顶部的 `RECENT_MONTHS` 常量
- 换数据源：`node _yun_writeback.js --json=YUNEXPRESS_track_2026-01-15_20261019_165757.json`
- 不指定 `--json` 时，自动选用 `Data Import/` 下**文件名排序最新**的 `YUNEXPRESS_track_*.json`

### **验证写入链路是否真的生效（金丝雀测试）**

当 dry-run 显示「需更新 0 条」时，`--write` 是空操作，**不能据此宣称回写功能已验证**。此时用金丝雀测试取得可观测证据：

```powershell
# 1. 先落盘快照（回滚兜底 + 无误伤比对基准）
# 2. 挑 2~3 条，故意写成 shipment_status='created'、dest_tracking=null
# 3. 回写这几条
node _yun_writeback.js --write --only=<被扰动的运单号>
# 4. 独立查询 DB，确认已精确恢复快照中的原值
# 5. 跑全量验证，确认快照前后 7 字段完全一致
node _yun_verify_writeback.js
```

> ⚠️ 扰动生产数据前**必须先落盘快照**，且扰动值要能被回写脚本自动还原（正确值就在查询 JSON 里），风险才可控。

---

## 📋 输出文件

### **查询结果（`Data Import/`）**

| 文件 | 说明 |
|---|---|
| `YUNEXPRESS_track_<process_date>_<时间戳>.json` | 完整查询结果，**回写脚本的数据源**，26 个字段 |
| `YUNEXPRESS_track_<process_date>_<时间戳>.csv` | 同内容 CSV，供人工核对与归档 |
| `云途YUNExpress运单查询报告_<process_date>.md` | 查询报告（含映射链路与比对统计） |
| `云途YUNExpress运单回写报告_<process_date>.md` | 回写报告（含验证结论与 65 条明细） |

JSON 字段说明：

| 字段 | 来源 | 说明 |
|---|---|---|
| `tracking_no` / `transaction_id` / `channel_id` | 数据库 | 运单号、订单号、渠道 |
| `db_shipment_status` / `db_dest_tracking` | 数据库 | 回写前的库中现值 |
| `api_package_status` / `api_package_status_desc` | 轨迹 API | 状态码与官方释义 |
| `api_dest_tracking` | 轨迹 API | 尾程跟踪号 |
| `api_status_cn` / `mapped_shipment_status` | 配置 | 中文状态名、映射后的 DB 枚举 |
| `status_compare` / `dest_tracking_match` | 脚本 | 与库中值的比对结论 |
| `last_mile_code` / `last_mile_name` / `last_mile_site` | last-mile API | 尾程派送商信息 |
| `product_name` / `channel_code` / `destination_code` / `check_out_time` | 轨迹 API | 渠道与交运信息 |
| `event_count` / `last_event_time` / `last_event_node` / `last_event_content` | 轨迹 API | 轨迹事件统计 |
| `query_ok` / `error_code` / `error_msg` | 脚本 | 查询是否成功及错误详情 |

### **执行日志（`Data Import/Process Log/`）**

| 文件 | 说明 |
|---|---|
| `YUNEXPRESS_writeback_<date>_dryrun_<时间戳>.log` | dry-run 差异报告 |
| `YUNEXPRESS_writeback_<date>_write_<时间戳>.log` / `.json` | 实际写入日志与逐条结果 |
| `YUNEXPRESS_verify_<date>_<时间戳>.log` / `.json` | 验证报告与结构化结果 |
| `YUNEXPRESS_snapshot_before_<date>.json` | **回写前快照（回滚凭据，请勿删除）**，验证脚本检查 5 的比对基准 |

---

## 📊 生产数据记录

### **2026-01-15 批次 YUNExpress 查询与回写（2026-10-19 执行）**

**查询阶段**

| 指标 | 结果 |
|---|---|
| 目标范围 | `carrier = 'YUNExpress'` AND `process_date = '2026-01-15'` |
| 运单总数 | 65 |
| 轨迹查询成功 | **65 / 65（100%）** |
| 轨迹查询失败 | 0 |
| 取得尾程跟踪号 | **65 / 65（100%）** |
| 包裹状态分布 | `D 投递成功` × 65（全部妥投） |
| 最后轨迹节点 | `DELIVERED` × 65 |
| 轨迹事件总数 | 1383 条，平均 21.3 条/单 |
| 交运时间范围 | 2026-01-15 22:39 ~ 2026-01-30 06:17 (UTC) |
| 妥投时间范围 | 2026-01-21 09:56 ~ 2026-02-04 16:04 (UTC) |
| 渠道分布 | 服装专线挂号 36 / 特惠带电 28 / 特惠普货 1 |

**回写阶段**

| 阶段 | 动作 | 结果 |
|---|---|---|
| 1 | 回写前快照（7 列全量落盘） | 65 条，全部 `shipped`，`dest_tracking` 无空缺 |
| 2 | 全量 dry-run | 需更新 **0**，已一致 **65** |
| 3 | 金丝雀测试（3 条扰动后回写） | 提交 3，读回校验通过 **3**，失败 0 |
| 4 | 全量 `--write` | 提交 **0**（幂等），失败 0 |

**验证阶段（5 项检查）**

| 检查项 | 结果 |
|---|---|
| `dest_tracking` DB vs API | **65 / 65（100.00%）** |
| `shipment_status` DB vs `mapApiStatus()` | **65 / 65（100.00%）** |
| 完整性（NULL 状态 / 空尾程号 / 非法枚举） | **0 / 0 / 0** |
| `tracking_no` 唯一性 | 65 条 / 65 唯一，无重复 |
| 快照前后 7 字段对比 | 完全一致 **65**，变化 **0**，消失行 **0** |

> **结论：✅ 回写功能验证通过，数据正确、完整、无误伤。**

**金丝雀测试明细**（证明写入链路真实生效）

| 运单号 | 扰动后 | 回写后 | 复核 |
|---|---|---|---|
| `YT2601500702042464` | `created` / `null` | `shipped` / `00340434518429947429` | ✓ |
| `YT2601500701870139` | `created` / `null` | `shipped` / `CB082909753IE` | ✓ |
| `YT2601500703032027` | `created` / `null` | `shipped` / `9261290306531781936687` | ✓ |

**安全护栏测试**（5 条合成数据 dry-run，未落库）

| # | 构造场景 | 实际行为 |
|---|---|---|
| 1 | `query_ok = N` 但带尾程号 | 整条跳过，未进入待写清单 ✓ |
| 2 | `package_status = N` + 尾程号为空 | 两个字段都跳过 ✓ |
| 3 | `package_status = X`（未收录码） | `shipment_status` 跳过，仅 `dest_tracking` 待写 ✓ |
| 4 | `package_status = C` + 尾程号为空 | `shipped → cancelled`，`dest_tracking` **未被空值覆盖** ✓ |
| 5 | `tracking_no` 库中不存在 | 告警跳过，不新建记录 ✓ |

---

## 🔍 异常运单分析

**本批次无异常运单**：65 条全部查询成功、全部取得尾程跟踪号、全部妥投（`D`）、库中值与 API 完全一致。

与华翰 / 燕文批次的对比：

| 物流商 | 批次 | 总数 | 无尾程号 | 主要原因 |
|---|---|---|---|---|
| HH EXPRESS | 2026-08 | 581 | 13 | HHWUE 前缀特殊渠道（11）+ IR 仅预报未发出（2） |
| YANWEN | 2026-02-07 | 7 | 2 | 长期 `created` 未实际揽收 |
| **YUNExpress** | **2026-01-15** | **65** | **0** | **—** |

> 云途轨迹接口与 last-mile 接口在本批中返回的尾程号 100% 一致，未出现华翰 `getLastTrackCode` 对特殊前缀不返回尾程号的情况。
>
> 后续若查询 `created` 状态的近期批次，预期会出现 `F`（仅预报）与 `N`（查无此单）状态，届时须依赖「映射安全规则」跳过 `shipment_status` 更新。

---

## 🔗 与物流商运单导入工作流的关系

| 维度 | Excel 导入工作流 | **本 API 工作流** |
|---|---|---|
| 触发方式 | 人工上传物流商后台导出的 Excel | 脚本主动拉取 API |
| 数据粒度 | 物流商后台导出的中文状态（细） | API 状态码（粗，7 个） |
| 状态词表 | `SHIPMENT_STATUS_MAP`（中文 → 枚举） | `API_STATUS_MAP` → `SHIPMENT_STATUS_MAP`（二级翻译） |
| 记录创建 | 会 upsert 新记录 | **只更新已存在记录，绝不新建** |
| 适用时机 | 首次批量导入 | 导入后的定期状态刷新与尾程号补齐 |

两者**共用同一份配置文件** `carrier-shipment-config`，因此状态口径天然一致，不会出现「Excel 导入判为 shipped、API 回写判为 created」的矛盾。

**推荐组合用法**：先用 Excel 导入工作流建立运单基础数据，再用本工作流定期刷新状态与尾程号。

---

## 📝 注意事项

### **API 调用限制**
- 轨迹接口是 `single` 类型，**只能逐单查询**，65 条即 65 次请求；并发上限设为 5，请求间隔 120ms
- last-mile 接口单批**最多 20 个**运单号，超出会被拒绝
- accessToken 有效期 7200 秒，务必缓存复用；每次请求都换 token 会浪费配额

### **签名相关**
- `date` 必须是**毫秒**时间戳，用秒会签名失败
- 签名内容中字段名顺序固定为 `body` → `date` → `method` → `uri`，不可调换
- `uri` 必须与实际请求 URI 逐字符一致：GET 带 query 要含 query，POST 无 query **不能带尾部 `?`**
- 本机时钟偏差超过 300 秒会导致签名失效，排查签名问题时先校时

### **数据库注意事项**
- `order_shipment` 只有 7 列，`select` 不要写 `id` / `updated_at` / `shipment_date`
- Supabase 不支持在 WHERE 中用关联表字段过滤（如 `orders.order_date`），需改用本表的 `process_date`
- `.in()` 批量查询有 URL 长度限制，运单号很多时应分批
- 回写并发 50/批已在生产验证，不影响其他表写入

### **Windows PowerShell 环境**
- 不支持 `&&` 作为语句分隔符，用 `;`
- Node 的 UTF-8 输出会被 PowerShell 按 GBK 解码导致中文乱码；`chcp 65001` 与 `[Console]::OutputEncoding = UTF8` 均**无效**
- 可靠做法：用 Node `spawnSync` 包装器捕获 stdout 直接写 UTF-8 文件，绕开 PowerShell 管道；读文件时用 `[Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(936)` + `Get-Content -Encoding UTF8`
- 判断 Markdown 文件是否真乱码，应检查是否含 `U+FFFD` 替换符，而不是看控制台显示

### **配置文件维护**
- **只改 `.ts`**，改完跑生成器同步 `.js` 镜像；直接改 `.js` 会在下次生成时被覆盖
- 新增物流商 API 时，在 `API_STATUS_MAP` 与 `API_STATUS_DESC` 各加一条即可
- 不要在业务脚本里维护私有状态映射表

---

## 📂 相关文件

| 文件路径 | 说明 |
|---------|------|
| `tools/_yun_query_batch.js` | 批量查询 API 主脚本（token 缓存 + 签名 + 并发 + 重试） |
| `tools/_yun_writeback.js` | 回写主脚本（默认 dry-run，`--write` 落库，并发 50/批，写后读回校验） |
| `tools/_yun_verify_writeback.js` | 独立验证脚本（API × DB × 快照 三方交叉核验，5 项检查） |
| `tools/lib/admin/column-maps/carrier-shipment-config.js` | 物流商配置 CLI 镜像（**自动生成**） |
| `tools/lib/admin/column-maps/generate-carrier-config-mirror.js` | 镜像生成器 |
| `source/lib/admin/column-maps/carrier-shipment-config.ts` | 物流商配置**单一数据源** |
| `docs/API接口文档/云途开放平台/` | 云途开放平台 API 原始文档缓存（开发文档树、接口字典、公共请求头、接口定义、响应样例） |
| `云途API KEY.txt` | API 认证凭据 |
| `Data Import/YUNEXPRESS_track_*.json` / `.csv` | 查询结果文件 |
| `Data Import/云途YUNExpress运单查询报告_2026-01-15.md` | 查询报告 |
| `Data Import/云途YUNExpress运单回写报告_2026-01-15.md` | 回写报告 |
| `Data Import/Process Log/YUNEXPRESS_*` | 执行与验证日志 |
| `workflow/CARRIER_SHIPMENT_IMPORT_WORKFLOW.md` | 物流商运单 Excel 导入工作流 |
| `workflow/CARRIER_SHIPMENT_HH_API_WORKFLOW.md` | 华翰 API 工作流 |
| `workflow/CARRIER_SHIPMENT_YANWEN_API_WORKFLOW.md` | 燕文 API 工作流 |

---

## ⚡ 性能记录

| 环节 | 数据量 | 耗时 | 说明 |
|---|---|---|---|
| API 查询（轨迹 + last-mile） | 65 条 | ~25 秒 | 轨迹 5 路并发 + 120ms 间隔；last-mile 4 批 × ≤20 |
| 回写 dry-run | 65 条 | 1.0~1.4 秒 | 1 次 SELECT + 本地差异计算 |
| 回写 `--write`（3 条金丝雀） | 3 条 | 2.0 秒 | 并发 50/批 + 写后读回 |
| 回写 `--write`（全量幂等） | 65 条 | 1.0 秒 | 需更新 0，提交 0 条 UPDATE |
| 验证 | 65 条 | ~2 秒 | 1 次 SELECT + 三方比对 |

**未来升级**：`database-migrations/add-bulk-update-shipments-function.sql` 中的 RPC 批量更新函数已就绪，
部署后回写可降至单次 HTTP 调用（~2-3 秒/数百条）。因无法通过 REST API 执行 DDL，需登录 Supabase Dashboard 手动部署。
当前数据量（数十至数百条）下并发 50/批已足够，暂不升级。

---

## 📌 更新日志

### **v1.1 (2026-10-30)**
- ✅ `R`（Package returned）状态码映射由 `shipped` / `cancelled` 统一改为 `returned`，与燕文 `SC38` 退件签收走同一退货通路
- ✅ 三处数据源统一：`source/lib/admin/carrier-configs/carrier-shipment-config.ts` 的 `SHIPMENT_STATUS_MAP['YUNExpress']['已退件']`、CLI 镜像 `tools/lib/admin/carrier-configs/carrier-shipment-config.js` 同键、本文档状态码参考表
- ✅ 修复历史不一致问题：改前 `已退件` 在 `.ts` 主配置为 `cancelled`、CLI 镜像为 `shipped`、本文档为 `shipped`，三方漂移；现统一为 `returned`
- ✅ 状态码参考表 R 行的业务含义由「退件/弃件（终态）」改为「退件签收（终态）」，说明段落同步更新
- ✅ 下游联动：`/api/admin/check-returned-orders` 自动按 `shipment_status = 'returned'` 捞取 R 运单进入退货核查页；通过 `/api/admin/return-orders` 可把关联订单 `order_status` 置为 `returned`
- ✅ 端到端验证 7 个云途状态码（含 R / N 跳过）全部符合预期

### **v1.0 (2026-10-20)**
- ✅ 初始版本发布
- ✅ 打通云途 OAuth2.0 鉴权全链路：`client_credentials` 换 token + HmacSHA256 逐请求签名 + `token`/`date`/`sign` 三请求头
- ✅ 澄清 `sourceKey` 语义：可选字段，省略可用，传值即校验（传错报 `0200412101`）
- ✅ 覆盖完整工作流：查询 → 状态映射 → 回写 → 独立验证
- ✅ 状态映射收敛到 `carrier-shipment-config` 单一数据源，采用二级翻译（API 码 → 中文名 → DB 枚举）
- ✅ 基于 65 条 2026-01-15 批次运单实际验证：查询 100% 成功，回写后双 100% 匹配，完整性问题 0
- ✅ 金丝雀测试证明写入链路真实生效；5 条安全护栏规则逐条验证通过
- ✅ 记录 4 个签名/参数踩坑点（`uri` 尾部 `?`、`waybill_numbers` 字段名、`date` 毫秒、`select` 不含 `id`）
- ✅ 补充与华翰 / 燕文工作流的差异对比

---

**最后更新**: 2026-10-30  
**维护者**: Lingma AI Assistant  
**文档状态**: ✅ 已创建并验证
