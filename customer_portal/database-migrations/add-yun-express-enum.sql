-- 添加 YunExpress 运单状态枚举值
-- 执行此脚本前请确认 shipment_status_enum 类型存在

-- 添加 'delivered' 状态（用于已签收/已收货）
ALTER TYPE shipment_status_enum ADD VALUE IF NOT EXISTS 'delivered';

-- 添加 'cancelled' 状态（用于已退件/已删除）
ALTER TYPE shipment_status_enum ADD VALUE IF NOT EXISTS 'cancelled';

-- 验证添加结果
SELECT unnest(enum_range(NULL::shipment_status_enum)) AS status;
