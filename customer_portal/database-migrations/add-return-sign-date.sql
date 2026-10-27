-- 添加退货签收入库时间字段到 orders 表
-- Date: 2026-10-14
-- Description: 添加 return_sign_date 字段，用于记录退货签收入库的时间

-- 添加 return_sign_date 字段（位于 return_qty 之后）
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_sign_date DATE;

-- 验证：查询 orders 表所有字段
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
