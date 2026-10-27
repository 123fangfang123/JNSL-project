/**
 * C003 订单导入配置
 * 
 * 用于将 C003 ERP 系统导出的订单 Excel 文件映射到数据库 orders 表
 */

// Excel 列名 → 数据库字段映射
const COLUMN_MAP = {
  '订单编号': 'transaction_id',      // 主键，唯一标识
  '交易编号': 'order_number',        // 订单号（整数）
  '店铺名': 'store_name',            // 店铺名称
  '付款时间': 'order_date',          // 订单日期（Excel 日期格式）
  '交运时间': 'process_date',        // 交运时间（订单处理日期）
  '发货时间': 'dispatch_date',       // 发货时间（实际发货日期）
  '订单状态': 'order_status',        // 订单状态（中文→英文）
  '国家': 'country',                 // 国家
  '是否重发订单': 'is_abnormal',     // 是否异常订单
  '重发原因': 'abnormal_code',       // 异常代码
  '订单总金额': 'order_cny_value',   // 订单人民币金额
  '汇率(原币)': 'order_ex_rate',     // 订单使用的汇率
}

// 订单状态映射（中文 → 英文枚举）
const ORDER_STATUS_MAP = {
  '配货中': 'processed',
  '已发货': 'shipped',
  '待处理': 'received',
  '待审核': 'processed',
  '已作废': 'cancelled',
  // 直接透传英文值
  'received': 'received',
  'processed': 'processed',
  'shipped': 'shipped',
  'cancelled': 'cancelled',
}

// 异常代码映射（重发原因 → AbnormalCode 枚举）
// 注意：需要根据实际的"重发原因"列的值来完善这个映射
const ABNORMAL_CODE_MAP = {
  // 示例映射（需要根据实际数据调整）
  '客户取消': 'customer_request',
  '客户要求': 'customer_request',
  '修改信息': 'customer_request',  // 客户主动修改订单信息
  '商品破损': 'damaged',
  '破损': 'damaged',
  '损坏': 'damaged',
  '发错货': 'wrong_item',
  '错发': 'wrong_item',
  '漏发': 'missing_item',
  '少发': 'missing_item',
  '包裹丢失': 'package_lost',
  '丢失': 'package_lost',
  '物流更改': 'change_shipping',
  '换物流': 'change_shipping',
  '系统错误': 'shopify_error',
  '平台错误': 'shopify_error',
  '质量问题': 'defective',
  '缺陷': 'defective',
  // amend_info 相关映射（待后续在 Excel 中添加对应字段）
  // '添加电话': 'amend_info',
  // '修改地址': 'amend_info',
  // '添加备注': 'amend_info',
}

// 需要忽略的列（不上传到数据库）
const IGNORED_COLUMNS = [
  // 当前没有需要忽略的列
]

// 数据类型转换配置
const FIELD_TRANSFORMS = {
  // transaction_id: 保持字符串
  transaction_id: (val) => String(val).trim(),
  
  // order_number: 转为整数
  order_number: (val) => {
    const num = parseInt(String(val), 10)
    return isNaN(num) ? null : num
  },
  
  // order_date: Excel 日期序列号 → YYYY-MM-DD
  order_date: (val) => {
    if (val == null) return null
    if (typeof val === 'number') {
      // Excel 日期序列号转换（从 1900-01-00 开始）
      const ms = Math.round((val - 25569) * 86400 * 1000)
      return new Date(ms).toISOString().slice(0, 10)
    }
    const s = String(val).trim()
    return s ? s.slice(0, 10).replace(/\//g, '-') : null
  },
  
  // process_date: Excel 日期序列号 → YYYY-MM-DD（交运时间）
  process_date: (val) => {
    if (val == null) return null
    if (typeof val === 'number') {
      const ms = Math.round((val - 25569) * 86400 * 1000)
      return new Date(ms).toISOString().slice(0, 10)
    }
    const s = String(val).trim()
    return s ? s.slice(0, 10).replace(/\//g, '-') : null
  },
  
  // dispatch_date: Excel 日期序列号 → YYYY-MM-DD（发货时间）
  dispatch_date: (val) => {
    if (val == null) return null
    if (typeof val === 'number') {
      const ms = Math.round((val - 25569) * 86400 * 1000)
      return new Date(ms).toISOString().slice(0, 10)
    }
    const s = String(val).trim()
    return s ? s.slice(0, 10).replace(/\//g, '-') : null
  },
  
  // order_status: 中文 → 英文枚举
  order_status: (val) => {
    if (val == null) return null
    const s = String(val).trim()
    return ORDER_STATUS_MAP[s] ?? null
  },
  
  // is_abnormal: "是"/"否" → boolean
  is_abnormal: (val) => {
    if (val == null) return false
    const s = String(val).trim()
    return s === '是' || s === 'yes' || s === 'true' || s === 'Y'
  },
  
  // abnormal_code: 中文原因 → 枚举值
  abnormal_code: (val) => {
    if (val == null || val === '') return null
    const s = String(val).trim()
    return ABNORMAL_CODE_MAP[s] ?? null
  },
  
  // order_cny_value: 转为数字（保留2位小数）
  order_cny_value: (val) => {
    if (val == null || val === '') return null
    const num = parseFloat(String(val))
    return isNaN(num) ? null : Math.round(num * 100) / 100
  },
  
  // order_ex_rate: 转为数字（保留4位小数）
  order_ex_rate: (val) => {
    if (val == null || val === '') return null
    const num = parseFloat(String(val))
    return isNaN(num) ? null : Math.round(num * 10000) / 10000
  },
  
  // store_name: 保持字符串
  store_name: (val) => {
    if (val == null) return null
    return String(val).trim()
  },
  
  // country: 保持字符串
  country: (val) => {
    if (val == null) return null
    return String(val).trim()
  },
}

module.exports = {
  COLUMN_MAP,
  ORDER_STATUS_MAP,
  ABNORMAL_CODE_MAP,
  IGNORED_COLUMNS,
  FIELD_TRANSFORMS,
}
