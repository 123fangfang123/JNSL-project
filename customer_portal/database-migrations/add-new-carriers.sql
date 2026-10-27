-- 为 carrier_enum 添加新的承运商枚举值
-- Date: 2026-08-07
-- Description: 添加 HH EXPRESS 和 XJ LOGISTICS 两个新承运商

-- 添加 HH EXPRESS
ALTER TYPE carrier_enum ADD VALUE IF NOT EXISTS 'HH EXPRESS';

-- 添加 XJ LOGISTICS
ALTER TYPE carrier_enum ADD VALUE IF NOT EXISTS 'XJ LOGISTICS';

-- 添加注释说明
COMMENT ON COLUMN order_shipment.carrier IS '承运商：YUNExpress(云途), YANWEN(燕文), HH EXPRESS, XJ LOGISTICS';

-- 验证：查询当前所有不同的 carrier 枚举值
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (
  SELECT oid 
  FROM pg_type 
  WHERE typname = 'carrier_enum'
)
ORDER BY enumsortorder;
