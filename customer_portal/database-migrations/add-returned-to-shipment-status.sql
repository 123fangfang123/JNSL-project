-- 添加 'returned' 状态到 shipment_status_enum（用于已退货）
ALTER TYPE shipment_status_enum ADD VALUE IF NOT EXISTS 'returned';

-- 验证添加结果
SELECT unnest(enum_range(NULL::shipment_status_enum)) AS status;
