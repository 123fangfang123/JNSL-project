/**
 * ============================================================
 *  运费账单导入配置文件
 *  对应工作流文档: FREIGHT_BILL_IMPORT_WORKFLOW.md
 *  
 *  注意: 此配置专用于运费账单 Excel 文件导入
 *  运单导入配置请参考: ../carrier-configs/carrier-shipment-config.js
 *  两者的 Excel 文件列名不同，识别关键字不同，不可混用
 * ============================================================
 */

const FREIGHT_BILL_CONFIG = {

  // ==================== 物流商自动识别 ====================
  // 通过扫描 Excel 表头中的关键字来识别物流商
  // 关键字来源于各物流商运费文件独有的列名
  // 
  // ⚠️ 与 ../carrier-configs/carrier-shipment-config.js 的 CARRIER_IDENTIFIERS 不同！
  //    运单文件列名: 运单号、状态、转单号、跟踪号、订单状态...
  //    运费文件列名: 到货时间、账单日期、发生时间、收货时间、计费重量、总费用...
  //
  CARRIER_IDENTIFIERS: {
    // GC 物流（易可达）- 运费文件独有列名（优先级最高，因为华翰的"总费用"太通用）
    '出库时间': 'GC',
    '计费重量（KG）': 'GC',  // GC 特有的重量列名（带单位后缀）
    '订单参考号': 'GC',
    'GC':       'GC',
    '易可达':   'GC',

    // 华翰物流 - 运费文件独有列名
    '到货时间': 'HH EXPRESS',
    '其它杂费': 'HH EXPRESS',
    'HH':       'HH EXPRESS',
    'HH Express': 'HH EXPRESS',
    '总费用': 'HH EXPRESS',  // 注意：虽然雄九也有"总金额"，但华翰是"总费用"

    // 燕文物流 - 运费文件独有列名（必须在雄九之前，因为燕文文件也有"转单号"）
    '账单日期': 'YANWEN',
    '账单金额': 'YANWEN',  // 使用不带单位后缀的版本作为识别关键字
    '账单金额(元)': 'YANWEN',  // 同时支持带单位后缀的版本
    '燕文':     'YANWEN',
    'Yanwen':   'YANWEN',

    // 云途物流 - 运费文件独有列名
    '发生时间': 'YUNExpress',
    '交易金额': 'YUNExpress',
    '云途':     'YUNExpress',
    'YunExpress': 'YUNExpress',
    'Yun Express': 'YUNExpress',

    // 雄九物流 - 运费文件独有列名（优先级最低）
    '收货时间': 'XJ LOGISTICS',
    '总金额': 'XJ LOGISTICS',
    '转单号': 'XJ LOGISTICS',  // 注意：燕文文件也有"转单号"，所以雄九的识别优先级要低于燕文
    '雄九':     'XJ LOGISTICS',
    'XJ':       'XJ LOGISTICS'
  },

  // ==================== 各物流商的列映射 ====================
  // Excel 列名 → freight 表字段
  // 脚本只读取配置中定义的列名，不多读任何额外列
  //
  // ⚠️ 列名必须与实际 Excel 文件表头完全一致（包括单位后缀）

  CARRIER_COLUMN_MAPS: {
    // 华翰物流
    // 实际文件: 华翰运费账单202607.xls / HH_Freight_07.xls
    // 表头: 到货时间, 客户单号, 运单号, 跟踪单号, 销售产品, 货物类型, 目的国家, 计费重量, 运费, 燃油费, 挂号费, 其它杂费, 总费用
    'HH EXPRESS': {
      '运单号': 'tracking_no',
      '到货时间': 'billing_date',
      '计费重量': 'weight_g',
      '总费用': 'freight',
      '运费': 'freight_fee',
      '挂号费': 'registered_fee'
      // other_fee = freight - freight_fee - registered_fee
      // （包含燃油费 + 其它杂费）
    },

    // 燕文物流（不提供费用拆分，仅有总额）
    // 实际文件: 燕文20225413_2026-09-18_2026-10-18.xlsx / Yanwen_freight_0701-0802.xlsx
    // 表头: 发货账号, 运单号, 订单号, 转单号, 流水号, 产品名称, 目的地, 实际重量(g), 计费重量(g), 长(cm), 宽(cm), 高(cm), 计费时间, 账单日期, 账单金额(元), 费用类型
    'YANWEN': {
      '运单号': 'tracking_no',
      '账单日期': 'billing_date',
      '计费重量(g)': 'weight_g',
      '账单金额(元)': 'freight'
      // freight_fee / registered_fee / other_fee 均留空
    },

    // 云途物流
    // 实际文件: Yun_express_freght_07.xlsx / 云途02e2a6d574cc47bdb971d4dff66ff563.xlsx
    // 表头: 交易类型, 发生时间, 交易产品, 国家代码, 国家名称, 币种代码, 客户单号, 运单号, 跟踪号, 计费重, 体积重, 实重, 交易金额, 运费, 燃油费, 挂号费, 处理费, VAT增值税, 重派费, 关税预付手续费, 偏远附加费, 退回费用, 特殊产品加收费, 其他费, 备注
    'YUNExpress': {
      '运单号': 'tracking_no',
      '发生时间': 'billing_date',
      '计费重': 'weight_g',
      '交易金额': 'freight',
      '运费': 'freight_fee',
      '挂号费': 'registered_fee'
      // other_fee = freight - freight_fee - registered_fee
      // （包含燃油费 + 处理费 + VAT增值税 + 重派费 + 关税预付手续费 + 偏远附加费 + 退回费用 + 特殊产品加收费 + 其他费）
    },

    // 雄九物流（不提供挂号费）
    // 实际文件: 雄九运费明细0812.xls / XJ_Freight_07.xls
    // 表头: 原单号, 转单号, 收货时间, 运输方式, 国家, 计费重, 运费, 燃油, 杂费, 总金额, 件数, 内部单号, 备注, 收件人名, 收件人邮编, 包裹材积, 代收货款, 代收货款币种
    'XJ LOGISTICS': {
      '转单号': 'tracking_no',
      '收货时间': 'billing_date',
      '计费重': 'weight_g',
      '总金额': 'freight',
      '运费': 'freight_fee'
      // registered_fee 留空
      // other_fee = freight - freight_fee
      // （包含燃油 + 杂费）
    },

    // GC 物流（易可达）
    // 实际文件: GC订单及运费.xlsx
    // 表头: 订单参考号, 订单状态, 创建时间, 出库时间, 跟踪号, 实际送达时间, 总费用, 订单总体积（CM³）, 实际重量（KG）, 计费重量（KG）
    'GC': {
      '跟踪号': 'tracking_no',
      '出库时间': 'billing_date',
      '计费重量（KG）': 'weight_g',
      '总费用': 'freight'
      // freight_fee / registered_fee / other_fee 均留空
      // freight 需要 × 6.7 转换为人民币
    }
  },

  // ==================== 重量单位配置 ====================
  // 'kg' = 文件中单位为 kg，写入数据库时需 ×1000 转为 g
  // 'g'  = 文件中单位已经是 g，无需转换
  WEIGHT_UNIT: {
    'HH EXPRESS': 'kg',
    'YANWEN': 'g',
    'YUNExpress': 'kg',
    'XJ LOGISTICS': 'kg',
    'GC': 'kg'
  },

  // ==================== 运费乘数配置 ====================
  // 部分物流商的运费需要乘以汇率转换为人民币
  // null 或不存在 = 不乘，直接使用原值
  FREIGHT_MULTIPLIER: {
    'HH EXPRESS': null,
    'YANWEN': null,
    'YUNExpress': null,
    'XJ LOGISTICS': null,
    'GC': 6.7  // GC 运费为美元，需 × 6.7 转为人民币
  },

  // ==================== 币种映射配置 ====================
  // 部分物流商的币种可能需要从缩写转换为标准代码
  // null 或不存在 = 不转换，直接使用原值
  CURRENCY_MAP: {
    'HH EXPRESS': null,
    'YANWEN': null,
    'YUNExpress': null,
    'XJ LOGISTICS': null,
    'GC': null
  },

  // ==================== other_fee 计算规则 ====================
  // null = 不计算，字段留空
  // 字符串 = 计算公式（基于已映射的 freight 表字段名）
  OTHER_FEE_FORMULA: {
    'HH EXPRESS': 'freight - freight_fee - registered_fee',
    'YANWEN': null,
    'YUNExpress': 'freight - freight_fee - registered_fee',
    'XJ LOGISTICS': 'freight - freight_fee',
    'GC': null  // GC 不提供费用拆分
  },
};

module.exports = FREIGHT_BILL_CONFIG;
