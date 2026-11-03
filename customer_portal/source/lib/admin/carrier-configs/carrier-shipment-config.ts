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
 * 版本: 1.4
 * 最后更新: 2026-11-03
 *
 * 变更:
 *   v1.4 (2026-11-03) 补齐 HH EXPRESS 的 API_STATUS_MAP / API_STATUS_DESC（以官方状态码表为准，
 *                     修正 CC 派送妥投、CA 到达尾程承运商、QF 已起飞、LD 已落地、AP 已交航等口径）；
 *                     SHIPMENT_STATUS_MAP['HH EXPRESS'] 增加通用「异常」键
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
    '退件签收': 'returned', // 2026-10-30 新增（燕文 SC38 专属）
    '已取消':  'cancelled',
  },
  'YUNExpress': {
    '已预报':   'created',
    '已删除':   'cancelled',
    '已退件':   'returned',
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
    '异常':                'shipped',   // 2026-11-03 新增：API 通用异常码（NA/FK）
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
  'YANWEN': {
    // 燕文 api.track.yw56.com.cn/api/tracking 返回的 tracking_status（状态码前缀分类见 API_STATUS_DESC）
    // 2026-10-30 由 _yanwen_query_batch.js 本地私有表迁入，统一走单一数据源
    OR10: '已制单', OR14: '已制单', OR16: '已制单', OR30: '已取消', OR35: '已取消',
    PU10: '已揽收', PU30: '异常',
    SC00: '运输中', SC10: '运输中', SC11: '运输中', SC12: '运输中', SC13: '运输中',
    SC15: '运输中', SC16: '运输中', SC17: '运输中', SC18: '运输中', SC19: '运输中',
    SC20: '运输中', SC21: '异常', SC26: '运输中', SC27: '运输中', SC34: '异常',
    SC36: '异常', SC37: '异常', SC38: '退件签收', SC40: '运输中', SC45: '运输中',
    SC45A: '运输中', SC45B: '运输中', SC63: '运输中', SC80: '异常', SC85: '异常',
    S201: '运输中', S202: '运输中', S203: '运输中', S204: '运输中', S205: '运输中',
    S206: '运输中', S207: '运输中', S208: '运输中', S209: '运输中', S210: '运输中',
    S211: '运输中', S212: '运输中', S213: '运输中',
    S301: '运输中', S302: '运输中', S303: '运输中', S304: '运输中', S305: '运输中', S306: '运输中',
    EC10: '运输中', EC20: '运输中', EC30: '异常',
    IC50: '运输中', IC51: '异常', IC54: '异常', IC55: '异常', IC60: '运输中',
    IC61: '运输中', IC70: '异常', IC80: '运输中', IC81: '运输中', IC82: '运输中',
    LH07: '运输中', LH08: '运输中', LH09: '运输中', LH10: '运输中', LH11: '运输中',
    LH12: '运输中', LH13: '运输中', LH14: '异常', LH15: '运输中', LH16: '运输中',
    LH20: '运输中', LH21: '运输中', LH22: '运输中', LH23: '运输中', LH24: '运输中',
    LH25: '运输中', LH26: '运输中', LH30: '运输中', LH31: '运输中', LH32: '运输中',
    LH33: '运输中', LH34: '运输中', LH35: '运输中', LH36: '异常', LH37: '异常',
    LH38: '运输中', LH39: '运输中', LH40: '运输中', LH45: '运输中', LH47: '运输中',
    LH48: '运输中', LH49: '运输中', LH55: '异常',
    LM03: '派送中', LM09: '派送中', LM10: '派送中', LM11: '派送中', LM12: '派送中',
    LM13: '派送中', LM15: '派送中', LM20: '派送中', LM25: '派送中', LM30: '派送中',
    LM35: '派送中', LM40: '已签收', LM40E: '派送中', LM45: '已签收',
    LM50: '异常', LM54: '异常', LM55: '派送中', LM56: '异常', LM57: '派送中',
    LM60: '异常', LM70: '异常', LM75: '异常', LM85: '异常', LM90: '异常',
    NT10: '运输中', OTHER: '异常',
  },
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
  'HH EXPRESS': {
    // getCargoTrack 返回的 Status，中文名以官方「轨迹状态代码对应表」为准（2026-11-03 补齐）
    IR: '电子信息已收到',   // 电子信息已收到
    AF: '已入仓',
    DF: '已出仓',
    GG: '已过港',
    BG: '已报关',
    AP: '已交航',
    QF: '已起飞',
    LD: '已落地',
    DR: '到达目的地',
    QG: '清关中',
    YG: '已清关',
    JY: '已交邮',
    CA: '到达尾程承运商',
    CB: '离开尾程承运商',
    YQ: '已提取',
    IA: '已上网',
    WB: '到达中转站',
    WD: '离开中转站',
    PB: '到达待取',
    ND: '运输中',
    CC: '派送妥投',
    AC: '清关异常',
    AE: '清关失败',
    DS: '已丢失',
    FI: '签收失败',
    UE: '退件',             // UE + 末尾 AF 的条件映射仍由调用方处理为 returned
    UH: '海外退件',
    // --- 官方表未收录但历史数据/镜像中出现过的兼容码 ---
    NO: '电子信息已收到',   // 新订单，轨迹本质为 IR
    AR: '到达中转站',
    DP: '离开中转站',
    OD: '运输中',           // 已派送，新词表无「派送中」
    TD: '运输中',
    PD: '派送妥投',
    NA: '异常',
    FK: '异常',             // 异常/退回
    RD: '退件',
    CW: '已取消',
    CN: '已取消',
    DN: null,               // 未找到：非业务状态，不更新 shipment_status
  },
}

/** API 状态码 → 官方中文释义（仅用于日志与报表展示） */
export const API_STATUS_DESC: Record<string, Record<string, string>> = {
  'YANWEN': {
    // 订单处理阶段 (OR*)
    OR10: '订单已生成', OR14: '尾程派送订单确认', OR16: '尾程创建订单成功',
    OR30: '订单已取消', OR35: '发货截留成功',
    // 揽收阶段 (PU*)
    PU10: '燕文已揽收', PU30: '揽收失败',
    // 仓库处理阶段 (SC*)
    SC00: '仓库处理', SC10: '仓库处理', SC11: '仓库处理', SC12: '仓库处理', SC13: '仓库处理',
    SC15: '仓库处理', SC16: '仓库处理', SC17: '仓库处理', SC18: '仓库处理', SC19: '仓库处理',
    SC20: '仓库处理', SC21: '异常件录入', SC26: '仓库处理', SC27: '仓库处理',
    SC34: '退件处理', SC36: '退件处理', SC37: '退件处理', SC38: '退件签收',
    SC40: '目的国承运商信息', SC45: '目的国承运商信息',
    SC45A: '目的国承运商信息', SC45B: '目的国承运商信息',
    SC63: '仓库处理', SC80: '异常', SC85: '异常',
    // 运输阶段 (S2xx / S3xx)
    S201: '待发运', S202: '交航', S203: '起飞', S204: '运输中', S205: '运输中',
    S206: '运输中', S207: '运输中', S208: '运输中', S209: '运输中', S210: '运输中',
    S211: '运输中', S212: '运输中', S213: '运输中',
    S301: '海外机场提货', S302: '海外清关', S303: '海外转运', S304: '运输中', S305: '运输中', S306: '运输中',
    // 清关阶段 (EC* / IC*)
    EC10: '出口报关', EC20: '出口报关', EC30: '出口清关异常',
    IC50: '进口清关', IC51: '进口清关异常', IC54: '进口清关异常', IC55: '进口清关异常',
    IC60: '进口清关', IC61: '进口清关', IC70: '进口清关异常',
    IC80: '进口清关', IC81: '进口清关', IC82: '进口清关',
    // 干线运输阶段 (LH*)
    LH07: '机场海关', LH08: '场站', LH09: '打板', LH10: '干线运输', LH11: '干线运输',
    LH12: '干线运输', LH13: '干线运输', LH14: '干线异常', LH15: '干线运输', LH16: '干线运输',
    LH20: '运输中', LH21: '运输中', LH22: '运输中', LH23: '运输中', LH24: '运输中',
    LH25: '运输中', LH26: '运输中', LH30: '到达', LH31: '提货', LH32: '理货',
    LH33: '运输中', LH34: '运输中', LH35: '运输中', LH36: '干线异常', LH37: '干线异常',
    LH38: '运输中', LH39: '运输中', LH40: '运输中', LH45: '运输中', LH47: '运输中',
    LH48: '运输中', LH49: '运输中', LH55: '确认干线丢件',
    // 尾程派送阶段 (LM*)
    LM03: '到达派送点', LM09: '派送中', LM10: '派送中', LM11: '派送中', LM12: '派送中',
    LM13: '派送中', LM15: '派送中', LM20: '派送中', LM25: '派送中', LM30: '到达待取',
    LM35: '尝试投递', LM40: '妥投成功', LM40E: '派送中', LM45: '海外退件签收成功',
    LM50: '派送失败', LM54: '异常', LM55: '派送中', LM56: '异常', LM57: '派送中',
    LM60: '异常', LM70: '异常', LM75: '异常', LM85: '包裹丢失', LM90: '异常',
    // 其他
    NT10: '运输中', OTHER: '异常',
  },
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
  'HH EXPRESS': {
    IR: '电子信息已收到',
    AF: '已入仓',
    DF: '已出仓',
    GG: '已过港',
    BG: '已报关',
    AP: '已交航',
    QF: '已起飞',
    LD: '已落地',
    DR: '到达目的地',
    QG: '清关中',
    YG: '已清关',
    JY: '已交邮',
    CA: '到达尾程承运商',
    CB: '离开尾程承运商',
    YQ: '已提取',
    IA: '已上网',
    WB: '到达中转站',
    WD: '离开中转站',
    PB: '到达待取',
    ND: '运输中',
    CC: '派送妥投',
    AC: '清关异常',
    AE: '清关失败',
    DS: '已丢失',
    FI: '签收失败',
    UE: '退件',
    UH: '海外退件',
    // 兼容码
    NO: '新订单',
    AR: '已到达中转设施',
    DP: '已从中转设施发出',
    OD: '已派送',
    TD: '运输中',
    PD: '已签收',
    NA: '异常',
    FK: '异常/退回',
    RD: '已退件',
    CW: '已取消',
    CN: '已取消',
    DN: '未找到',
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
