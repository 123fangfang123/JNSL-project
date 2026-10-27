-- 为 orders 表添加 updated_at 字段
-- 这个字段被 order_billing 表的触发器引用

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN orders.updated_at IS 'Last update timestamp';

-- 为已有记录设置 updated_at 为当前时间
UPDATE orders 
SET updated_at = NOW() 
WHERE updated_at IS NULL;
