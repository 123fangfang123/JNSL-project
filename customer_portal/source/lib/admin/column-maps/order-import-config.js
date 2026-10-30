/**
 * 订单导入配置文件
 * 
 * 用于标准化 ERP 导出文件的列名映射和数据转换
 * 适用于: 订单导出数据*.xlsx 文件
 */

module.exports = {
  // ==================== Excel 文件验证 ====================
  VALIDATION: {
    // 必需字段（缺少则跳过该订单）
    REQUIRED_COLUMNS: [
      '订单编号',
      '店铺名',
      'SKU',
      '商品数量',
      '付款时间',
      '交易编号',
      '国家',
      '订单状态',
      '是否重发订单',
      '重发原因',
      '订单总金额',
      '汇率(原币)',
      '订单商品名称',
      '商品编号(ItemId)',
      '货运单号',
      '交运时间',
      '物流渠道',
      '物流公司'
    ],
    
    // 可选字段（缺失时使用默认值或 NULL）
    OPTIONAL_COLUMNS: [

      '发货时间',
      '最新采购价'
    ]
  },

  // ==================== 列名映射（Excel → 数据库字段）====================
  COLUMN_MAP: {
    // orders 表字段
    '订单编号': 'transaction_id',           // 主键
    '交易编号': 'order_number',             // 订单号
    '店铺名': 'store_name',                 // 店铺名称
    '付款时间': 'order_date',               // 订单日期
    '发货时间': 'dispatch_date',            // 发货时间
    '订单状态': 'order_status',             // 订单状态（中文→英文，需要映射到枚举）
    '国家': 'country',                      // 国家
    '是否重发订单': 'is_abnormal',          // 是否异常订单
    '重发原因': 'abnormal_code',            // 异常代码
    '订单总金额': 'order_cny_value',        // 订单人民币金额
    '汇率(原币)': 'order_ex_rate',          // 订单使用的汇率
    
    // order_items 表字段
    'SKU': 'sku',                           // 商品SKU
    '商品数量': 'qty',                      // 商品数量
    '订单商品名称': 'product_name',         // 商品名称
    '商品编号(ItemId)': 'item_id',          // 商品ID
    
    // order_shipment 表字段
    '货运单号': 'tracking_no',              // 货运单号
    '交运时间': 'process_date',             // 交运时间（订单处理日期）
    '物流公司': 'carrier'                   // 物流公司名称（需要映射到枚举）
  },

  // ==================== 枚举值映射 ====================
  ENUM_MAP: {
    // 订单状态映射（中文 → 英文枚举）
    order_status: {
      '配货中': 'processed',
      '已发货': 'shipped',
      '待处理': 'received',
      '待审核': 'processed',
      '已作废': 'cancelled',
      '已退货': 'returned',
      // 直接透传英文值
      'received': 'received',
      'processed': 'processed',
      'shipped': 'shipped',
      'cancelled': 'cancelled',
      'returned': 'returned'
    },
    
    // 物流公司映射（Excel → carrier_enum）
  
    // 如果需要使用其他承运商，需要先添加到数据库
    carrier: {
      '燕文物流(新)': 'YANWEN',
      '燕文物流': 'YANWEN',
      '云途(新)': 'YUNExpress',
      'HH': 'HH EXPRESS',
      '雄九供应链': 'XJ LOGISTICS'
   
    },
    
    // 异常代码映射（重发原因 → abnormal_code）
    // 注意：abnormal_code 是 TEXT 类型，不是 ENUM
    // 这里映射为标准的异常代码值
    abnormal_code: {
      '发错': 'wrong_item',
      '丢包': 'package_lost',   
      '漏发': 'missing_item',
      '破损': 'damaged',
      '与实物不符': 'wrong_item',
      '更换渠道': 'change_shipping',
      '大件分单': 'change_shipping',
      '更换运单': 'change_shipping',   
      'SKU混淆': 'shopify_error',   
      '客户要求': 'customer_request',
      '修改信息': 'customer_request',
      '修改地址': 'amend_info'
    }
  },

  // ==================== 数据类型转换 ====================
  FIELD_TRANSFORMS: {
    // transaction_id: 保持字符串
    transaction_id: (val) => String(val).trim(),
    
    // order_number: 保持字符串
    order_number: (val) => {
      if (val == null || val === '') return null;
      return String(val).trim();
    },
    
    // order_date: Excel 日期序列号 → YYYY-MM-DD HH:mm:ss
    order_date: (val) => transformDateTime(val),
    
    // dispatch_date: Excel 日期序列号 → YYYY-MM-DD HH:mm:ss
    dispatch_date: (val) => transformDateTime(val),
    
    // process_date: Excel 日期序列号 → YYYY-MM-DD HH:mm:ss
    process_date: (val) => transformDateTime(val),
    
    // order_status: 中文 → 英文枚举
    order_status: (val) => {
      if (!val) return null;
      const s = String(val).trim();
      return module.exports.ENUM_MAP.order_status[s] || null;
    },
    
    // is_abnormal: "是"/"否" → boolean
    is_abnormal: (val) => {
      if (val == null) return false;
      const s = String(val).trim();
      return s === '是' || s === 'yes' || s === 'true' || s === 'Y';
    },
    
    // abnormal_code: 中文原因 → 标准异常代码
    abnormal_code: (val) => {
      if (!val || val === '') return null;
      const s = String(val).trim();
      return module.exports.ENUM_MAP.abnormal_code[s] || s; // 如果没有映射，保留原值
    },
    
    // order_cny_value: 转为数字（保留2位小数）
    order_cny_value: (val) => {
      if (val == null || val === '') return null;
      const num = parseFloat(String(val));
      return isNaN(num) ? null : Math.round(num * 100) / 100;
    },
    
    // order_ex_rate: 转为数字（保留4位小数）
    order_ex_rate: (val) => {
      if (val == null || val === '') return null;
      const num = parseFloat(String(val));
      return isNaN(num) ? null : Math.round(num * 10000) / 10000;
    },
    
    // sku: 保持字符串
    sku: (val) => String(val).trim(),
    
    // qty: 转为整数
    qty: (val) => {
      const num = parseInt(String(val), 10);
      return isNaN(num) ? 0 : num;
    },
    
    // tracking_no: 保持字符串
    tracking_no: (val) => val ? String(val).trim() : null,
    
    // carrier: 物流公司名称 → carrier_enum
    carrier: (val) => {
      if (!val) return null;
      const s = String(val).trim();
      return module.exports.ENUM_MAP.carrier[s] || null;
    },
    
    // store_name: 保持字符串
    store_name: (val) => val ? String(val).trim() : null,
    
    // country: 保持字符串
    country: (val) => val ? String(val).trim() : null,
    
    // product_name: 保持字符串
    product_name: (val) => val ? String(val).trim() : null,
    
    // item_id: 保持字符串
    item_id: (val) => val ? String(val).trim() : null
  },

  // ==================== 业务规则 ====================
  BUSINESS_RULES: {
    // shipment_status 初始值（新建运单时）
    DEFAULT_SHIPMENT_STATUS: 'created',
    
    // 价格对比：任何差异都提醒
    PRICE_ALERT_THRESHOLD_PERCENT: 0,
    
    // 批量处理大小
    BATCH_SIZE: 50
  },

  // ==================== 物流商运单导入配置 ====================
  CARRIER_IMPORT_CONFIG: {
    // 物流商标识映射（Excel 表头关键字 → 物流商名称）
    CARRIER_IDENTIFIERS: {
      '燕文': 'YANWEN',
      'Yanwen': 'YANWEN',
      '流水号': 'YANWEN',
      '云途': 'YUNExpress',
      'YunExpress': 'YUNExpress',
      'Yun Express': 'YUNExpress',
      'HH': 'HH EXPRESS',
      'HH Express': 'HH EXPRESS',
      '客户单号': 'HH EXPRESS',
      '雄九': 'XJ LOGISTICS',
      'XJ': 'XJ LOGISTICS',
      '专线单号': 'XJ LOGISTICS'
    },
    
    // 各物流商的列映射配置
    CARRIER_COLUMN_MAPS: {
      // 燕文物流
      'YANWEN': {
        '运单号': 'tracking_no',
        '订单号': 'transaction_id',
        '状态': 'shipment_status',
        '转单号': 'dest_tracking'
      },
      
      // 云途物流
      'YUNExpress': {
        '运单号': 'tracking_no',
        '客户单号': 'transaction_id',
        '订单状态': 'shipment_status',
        '跟踪号': 'dest_tracking'
      },
      
      // HH Express
      'HH EXPRESS': {
        '运单号': 'tracking_no',
        '客户单号': 'transaction_id',
        '状态': 'shipment_status',
        '跟踪号': 'dest_tracking'
      },
      
      // 雄九物流
      'XJ LOGISTICS': {
        '转单号': 'tracking_no',
        '原单号': 'transaction_id',
        '状态': 'shipment_status'
      }
    },
    
    // 运单状态映射（各物流商 → 数据库枚举）
    SHIPMENT_STATUS_MAP: {
      'YANWEN': {
        '已制单': 'created',
        '已揽收': 'shipped',
        '运输中': 'shipped',
        '派送中': 'shipped',
        '已妥投': 'shipped',
        '异常': 'shipped',
        '已取消': 'cancelled'
      },
      'YUNExpress': {
        '已预报': 'created',
        '已揽收': 'shipped',
        '运输中': 'shipped',
        '派送中': 'shipped',
        '已签收': 'shipped',
        '异常': 'shipped',
        '已取消': 'cancelled'
      },
      'HH EXPRESS': {
        '已取消': 'cancelled'
      },
      'XJ LOGISTICS': {
        '已出货订单': 'shipped',
        '签收订单': 'shipped',
        '异常': 'shipped',
        '已取消': 'cancelled'
      }
    }
  }
};

// ==================== 辅助函数 ====================

/**
 * 日期转换：Excel 日期序列号或字符串 → YYYY-MM-DD
 */
function transformDate(val) {
  if (val == null) return null;
  
  if (typeof val === 'number') {
    // Excel 日期序列号（从 1900-01-00 开始）
    const ms = Math.round((val - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  
  const s = String(val).trim();
  if (!s) return null;
  
  // 提取日期部分 YYYY-MM-DD
  return s.slice(0, 10).replace(/\//g, '-');
}

/**
 * 日期时间转换：Excel 日期序列号或字符串 → YYYY-MM-DD HH:mm:ss
 */
function transformDateTime(val) {
  if (val == null) return null;
  
  if (typeof val === 'number') {
    // Excel 日期序列号
    const ms = Math.round((val - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
  }
  
  const s = String(val).trim();
  if (!s) return null;
  
  // 替换分隔符并返回
  return s.replace(/\//g, '-');
}
