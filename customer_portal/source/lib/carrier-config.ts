/**
 * 物流公司配置
 */

export interface CarrierInfo {
  /** 序号 */
  value: number
  /** 中文名称 */
  labelZh: string
  /** 英文名称 */
  labelEn: string
}

export const CARRIERS: CarrierInfo[] = [
  { value: 1, labelZh: '云途(新)',   labelEn: 'YUNExpress' },
  { value: 2, labelZh: '燕文物流(新)',   labelEn: 'YANWEN' },
  { value: 3, labelZh: 'HH', labelEn: 'HH EXPRESS' },
  { value: 4, labelZh: '雄九供应链',   labelEn: 'XJ LOGISTICS' },
  { value: 5, labelZh: '美西仓库-易可达',   labelEn: 'GC' },
  { value: 6, labelZh: '美东仓库-易可达',   labelEn: 'GC' },
]

/** 物流公司→物流渠道映射 */
export const CARRIER_TO_CHANNEL: Record<string, string> = {
  'GC': 'GC_GROUND',
  'YANWEN': 'YANWEN',
  'YUNExpress': 'YUNEXPRESS',
  'HH EXPRESS': 'HH',
  'XJ LOGISTICS': 'XJ'
}

/** value → 中文名称 */
export const carrierLabelZh: Record<number, string> = Object.fromEntries(
  CARRIERS.map(c => [c.value, c.labelZh])
)

/** value → 英文名称 */
export const carrierLabelEn: Record<number, string> = Object.fromEntries(
  CARRIERS.map(c => [c.value, c.labelEn])
)

/** 中文名称 → 英文名称（用于导入时反向查找） */
export const carrierZhToEn: Record<string, string> = Object.fromEntries(
  CARRIERS.map(c => [c.labelZh, c.labelEn])
)

/** 根据 value 获取中文名称 */
export function getCarrierLabelZh(value: number | null | undefined): string {
  if (value == null) return ''
  return carrierLabelZh[value] ?? ''
}

/** 根据 value 获取英文名称 */
export function getCarrierLabelEn(value: number | null | undefined): string {
  if (value == null) return ''
  return carrierLabelEn[value] ?? ''
}

/** 根据中文名称获取英文名称，未匹配则原样返回 */
export function getCarrierEnByZh(zhName: string | null | undefined): string {
  if (!zhName) return ''
  return carrierZhToEn[zhName] ?? zhName
}
