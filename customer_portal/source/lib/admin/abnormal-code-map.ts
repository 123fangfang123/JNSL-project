export const abnormalCodeMap: Record<string, string> = {
  '发错': 'wrong_item',
  '与实物不符': 'wrong_item',
  '丢包': 'package_lost',
  '破损': 'damaged',
  '漏发': 'missing_item',
  '更换渠道': 'change_shipping',
  '大件分单': 'change_shipping',
  '更换运单': 'change_shipping',
  'SKU混淆': 'shopify_error',
  '客户要求': 'customer_request',
  '修改信息': 'customer_request',
  '修改地址': 'amend_info',
  '故障': 'defective',
  '瑕疵': 'defective',
  '故障/瑕疵': 'defective',
}

export function mapAbnormalCode(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = String(raw).trim()
  return abnormalCodeMap[trimmed] ?? ''
}
