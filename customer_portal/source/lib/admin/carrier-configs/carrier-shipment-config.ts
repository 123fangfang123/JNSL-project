/**
 * 物流商运单导入统一配置（单一数据源）
 *
 * 本文件是物流商运单导入的【唯一配置源】，前端和 CLI 共用：
 *   - 前端：各 shipments-*.ts 从此 re-export
 *   - CLI ：tools/lib/admin/carrier-configs/carrier-shipment-config.js 须与本文件保持同步
 *
 * 修改说明：
 *   新增物流商 → 在 CARRIER_IDENTIFIERS / CARRIER_COLUMN_MAPS / SHIPMENT_STATUS_MAP 各加一条
 *   修改列映射 → 只改 CARRIER_COLUMN_MAPS
 *   修改状态映射 → 只改 SHIPMENT_STATUS_MAP
 *   接入物流商 API → 在 API_STATUS_MAP / API_STATUS_DESC 各加一条（API 状态码 → 中文状态名）
 *
 * 版本: 1.3
 * 最后更新: 2026-10-20
 *
 * 变更:
 *   v1.3 (2026-10-20) 新增 XJ LOGISTICS 的 API_STATUS_MAP / API_STATUS_DESC（selectTrack.htm 的 businessStatus 恒等映射打底，真实值待 IP 加白后采样补充）
 *   v1.2 (2026-10-19) 合并 CLI 镜像中较新的状态码（YANWEN 已妥投 / HH EXPRESS 8 个 / XJ 已收货订单）；
 *                     CLI 镜像 carrier-shipment-config.js 改为由本文件自动生成，不再手工维护
 *   v1.1 (2026-10-19) 新增 API_STATUS_MAP / API_STATUS_DESC / mapApiStatus / getApiStatusDesc
 */

// ==================== 物流商基本信息 ====================

export interface CarrierMeta {
  /** 内部 key（前端 Carrier 类型值） */
  key: string
  /** 数据库存储名称（写入 order_shipment.carrier 字段） */
  dbName: string
  /** 前端显示名称 */
  displayName: string
}

export const CARRIERS: CarrierMeta[] = [
  { key: 'yunexpress', dbName: 'YUNExpress',    displayName: 'YUNExpress' },
  { key: 'yanwen',     dbName: 'YANWEN',        displayName: 'YANWEN' },
  { key: 'hh',         dbName: 'HH EXPRESS',    displayName: 'HH Express' },
  { key: 'xj',         dbName: 'XJ LOGISTICS',  displayName: 'XJ Logistics' },
]

/** key → dbName 快速查找 */
export const CARRIER_DB_NAME: Record<string, string> = Object.fromEntries(
  CARRIERS.map(c => [c.key, c.dbName])
)

// ==================== 物流商标识映射（CLI 自动识别用） ====================
// Excel 表头关键字 → 物流商 dbName

export const CARRIER_IDENTIFIERS: Record<string, string> = {
  // 燕文物流 - 独有关键字（优先级最高）
  '燕文':     'YANWEN',
  'Yanwen':   'YANWEN',
  '流水号':   'YANWEN',  // 燕文独有
  
  // 云途物流 - 独有关键字
  '云途':     'YUNExpress',
  'YunExpress': 'YUNExpress',
  'Yun Express': 'YUNExpress',
  '订单状态': 'YUNExpress',  // 云途独有
  
  // HH Express - 独有关键字
  'HH':       'HH EXPRESS',
  'HH Express': 'HH EXPRESS',
  '客户单号': 'HH EXPRESS',  // HH 独有
  
  // 雄九物流 - 独有关键字（优先级最低）
  '雄九':     'XJ LOGISTICS',
  'XJ':       'XJ LOGISTICS',
  '专线单号': 'XJ LOGISTICS',  // 雄九独有
  // 注意："转单号"在燕文和雄九文件中都有，不能作为识别关键字
}

// ==================== 各物流商的列映射配置 ====================
// Excel 列名 → 数据库字段名
// 支持数组值：一个 Excel 列 → 多个数据库字段（如雄九"转单号"同时写入 tracking_no 和 dest_tracking）

export const CARRIER_COLUMN_MAPS: Record<string, Record<string, string | string[]>> = {
  'YANWEN': {
    '运单号': 'tracking_no',
    '状态':   'shipment_status',
    '转单号': 'dest_tracking',
  },
  'YUNExpress': {
    '运单号':   'tracking_no',
    '订单状态': 'shipment_status',
    '跟踪号':   'dest_tracking',
  },
  'HH EXPRESS': {
    '客户单号': 'tracking_no',
    '状态':     'shipment_status',
  },
  'XJ LOGISTICS': {
    '转单号': ['tracking_no', 'dest_tracking'],
    '状态':   'shipment_status',
  },
}

// ==================== 运单状态映射 ====================
// 各物流商的 Excel 状态值 → 数据库枚举值 (created / shipped / cancelled)

export const SHIPMENT_STATUS_MAP: Record<string, Record<string, string>> = {
  'YANWEN': {
    '已制单':  'created',
    '已揽收':  'shipped',
    '运输中':  'shipped',
    '派送中':  'shipped',
    '已签收':  'shipped',
    '已妥投':  'shipped',   // 2026-10-19 由 CLI 镜像合并（与「已签收」同义，兼容两种导出用词）
    '异常':    'shipped',
    '已取消':  'cancelled',
  },
  'YUNExpress': {
    '已预报':   'created',
    '已删除':   'cancelled',
    '已退件':   'cancelled',
    '已揽收':   'shipped',
    '已发货':   'shipped',
    '运输中':   'shipped',
    '派送中':   'shipped',
    '已签收':   'shipped',
    '异常':     'shipped',
    '已取消':   'cancelled',
  },
  'HH EXPRESS': {
    '电子信息已收到':       'created',
    '运单电子信息已收到':   'created',
    '已入仓':              'shipped',
    '已出仓':              'shipped',
    '已过港':              'shipped',
    '已报关':              'shipped',
    '已交船':              'shipped',
    '已起飞':              'shipped',
    '已落地':              'shipped',
    '到达目的地':          'shipped',
    '清关中':              'shipped',
    '已清关':              'shipped',
    '已交邮':              'shipped',
    '到达尾程承运商':      'shipped',
    '离开尾程承运商':      'shipped',
    '已提取':              'shipped',
    '已上网':              'shipped',
    '到达中转站':          'shipped',
    '离开中转站':          'shipped',
    '到达待取':            'shipped',
    '运输中':              'shipped',
    '派送妥投':            'shipped',
    '清关异常':            'shipped',
    '清关失败':            'shipped',
    '已剔除':              'shipped',
    '签收失败':            'shipped',
    '退件':                'shipped',
    '海外退件':            'shipped',
    // --- 2026-10-19 由 CLI 镜像合并（含 2026-10-17 API 查询发现的新状态码）---
    '已交航':              'shipped',   // 与「已交船」同为交运节点的不同导出用词
    '已丢失':              'shipped',
    '已到达':              'shipped',   // API 状态码 AP
    '待处理':              'shipped',   // API 状态码 AP
    '清关完成':            'shipped',   // API 状态码 QF
    '已装载':              'shipped',   // API 状态码 LD
    '已通关':              'shipped',   // API 状态码 BG
    '信息已确认':          'shipped',   // API 状态码 IA
    '已取消':              'cancelled',
  },
  'XJ LOGISTICS': {
    '已收货确认': 'shipped',
    '已收货订单': 'shipped',   // 2026-10-19 由 CLI 镜像合并（与「已收货确认」同为收货节点的不同导出用词）
    '签收订单':   'shipped',
    '确认订单':   'shipped',
    '异常':       'shipped',
    '已取消':     'cancelled',
  },
}

// ==================== API 状态码映射 ====================
// 物流商 API 返回的状态码 → SHIPMENT_STATUS_MAP 中的中文状态名
//
// 设计原则：
//   1. 本表只做「API 状态码 → 配置词表中文名」的翻译，不直接给数据库枚举值；
//      最终 created/shipped/cancelled 统一由 SHIPMENT_STATUS_MAP 决定，避免出现第二套规则。
//   2. 值为 null 表示该状态码不代表任何业务状态（如云途 N=订单未找到），
//      按「未映射状态安全处理规则」返回 null，调用方不得写入 shipment_status。
//   3. API 状态粒度通常比 Excel 导出更粗（云途 API 无「已揽收/已发货/派送中/已删除」），
//      未出现在本表的中文状态属于 Excel 专有，无需反向映射。

/** API 状态码 → 中文状态名（null 表示不更新 shipment_status） */
export const API_STATUS_MAP: Record<string, Record<string, string | null>> = {
  'YUNExpress': {
    // 云途开放平台 GET /v1/track-service/info/get 返回的 package_status
    F: '已预报',   // Electronic forecast information reception 已接收电子预报
    T: '运输中',   // In transit 运输中
    D: '已签收',   // Successful delivery 投递成功
    E: '异常',     // May be abnormal 可能异常
    R: '已退件',   // Package returned 包裹退回
    C: '已取消',   // Order Cancellation 订单取消
    N: null,       // Order not found 订单未找到 —— 非业务状态，不更新
  },
  'XJ LOGISTICS': {
    // 雄九（华磊系统）POST /selectTrack.htm 返回的 businessStatus（中文文本）/ businessStatusCode。
    // 注意：正式环境 selectTrack.htm 有 IP 白名单，真实取值尚未采样。
    // 此处先以 SHIPMENT_STATUS_MAP['XJ LOGISTICS'] 已验证的 6 个中文状态做恒等映射打底，
    // 未收录的 businessStatus / businessStatusCode 一律返回 null（调用方跳过 shipment_status 更新），
    // 待 IP 加白后采样真实值再补充本表与 API_STATUS_DESC。
    '已收货确认': '已收货确认',
    '已收货订单': '已收货订单',
    '签收订单':   '签收订单',
    '确认订单':   '确认订单',
    '异常':       '异常',
    '已取消':     '已取消',
  },
}

/** API 状态码 → 官方中文释义（仅用于日志与报表展示） */
export const API_STATUS_DESC: Record<string, Record<string, string>> = {
  'YUNExpress': {
    N: '订单未找到',
    F: '已接收电子预报',
    T: '运输中',
    D: '投递成功',
    E: '可能异常',
    R: '包裹退回',
    C: '订单取消',
  },
  'XJ LOGISTICS': {
    // businessStatus 本身即中文，释义与状态名一致；businessStatusCode 待采样后补充
    '已收货确认': '已收货确认',
    '已收货订单': '已收货订单',
    '签收订单':   '签收订单',
    '确认订单':   '确认订单',
    '异常':       '异常',
    '已取消':     '已取消',
  },
}

/**
 * API 状态码 → 数据库 shipment_status 枚举值
 * @returns created / shipped / cancelled；无法映射时返回 null（调用方应跳过该字段更新）
 */
export function mapApiStatus(carrier: string, apiCode: string): string | null {
  if (!apiCode) return null
  const dict = API_STATUS_MAP[carrier]
  if (!dict) return null
  const code = String(apiCode).trim().toUpperCase()
  if (!(code in dict)) return null
  const cnStatus = dict[code]
  if (!cnStatus) return null
  return SHIPMENT_STATUS_MAP[carrier]?.[cnStatus] ?? null
}

/** API 状态码 → 中文释义（用于报表展示） */
export function getApiStatusDesc(carrier: string, apiCode: string): string {
  if (!apiCode) return ''
  return API_STATUS_DESC[carrier]?.[String(apiCode).trim().toUpperCase()] ?? ''
}

// ==================== 前端列映射（按 carrier key 导出） ====================
// 供前端 shipments-*.ts re-export 使用

export const COLUMN_MAPS_BY_KEY: Record<string, Record<string, string | string[]>> = {
  yunexpress: CARRIER_COLUMN_MAPS['YUNExpress'],
  yanwen:     CARRIER_COLUMN_MAPS['YANWEN'],
  hh:         CARRIER_COLUMN_MAPS['HH EXPRESS'],
  xj:         CARRIER_COLUMN_MAPS['XJ LOGISTICS'],
}

// ==================== 命名导出（供 shipments-*.ts re-export） ====================

export const shipmentsYunexpressColumnMap = CARRIER_COLUMN_MAPS['YUNExpress']
export const shipmentsYanwenColumnMap = CARRIER_COLUMN_MAPS['YANWEN']
export const shipmentsHhColumnMap = CARRIER_COLUMN_MAPS['HH EXPRESS']
export const shipmentsXjColumnMap = CARRIER_COLUMN_MAPS['XJ LOGISTICS']
