-- 为 orders 表添加新的异常代码枚举值
-- Date: 2026-08-07
-- Description: 添加 amend_info 用于客户主动修改订单信息的情况

-- abnormal_code 字段是 ENUM 类型 (abnormal_code_enum)
-- 需要添加新的枚举值
ALTER TYPE abnormal_code_enum ADD VALUE IF NOT EXISTS 'amend_info';

-- 添加注释说明
COMMENT ON COLUMN orders.abnormal_code IS '异常代码：customer_request(客户要求), amend_info(修改信息), damaged(破损), wrong_item(发错货), missing_item(漏发), package_lost(包裹丢失), change_shipping(物流更改), shopify_error(系统错误), defective(质量问题)';

-- 验证：查询当前所有不同的 abnormal_code 值
SELECT DISTINCT abnormal_code 
FROM orders 
WHERE abnormal_code IS NOT NULL
ORDER BY abnormal_code;
