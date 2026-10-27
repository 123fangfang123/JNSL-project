-- =====================================================
-- Orders 表拆分：基本信息 + 价格信息
-- =====================================================
-- 目标: 将 orders 表拆分为 orders（基本信息）+ order_pricing（价格信息）
-- 日期: 2026-10-14
-- =====================================================

BEGIN;

-- =====================================================
-- 步骤 0: 备份
-- =====================================================
CREATE TABLE IF NOT EXISTS orders_backup_20261014 AS 
SELECT * FROM orders;

DO $$
DECLARE
    original_count INTEGER;
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM orders;
    SELECT COUNT(*) INTO backup_count FROM orders_backup_20261014;
    
    IF original_count != backup_count THEN
        RAISE EXCEPTION '备份数量不匹配! 原始: %, 备份: %', original_count, backup_count;
    END IF;
    
    RAISE NOTICE '备份成功: % 条记录', backup_count;
END $$;

-- =====================================================
-- 步骤 1: 创建 order_pricing 表
-- =====================================================
CREATE TABLE IF NOT EXISTS order_pricing (
    transaction_id TEXT PRIMARY KEY REFERENCES orders(transaction_id) ON DELETE CASCADE,
    
    -- 订单价格
    order_cny_value NUMERIC(12,2),
    order_ex_rate NUMERIC(10,4),
    currency TEXT DEFAULT 'USD',
    
    -- 计费显示字段（触发器从 order_billing 同步）
    cog_usd NUMERIC(10,2),
    shipping_usd NUMERIC(10,2),
    fulfillment_usd NUMERIC(10,2),
    total_cost_usd NUMERIC(10,2),
    ex_rate_used NUMERIC(10,4),
    billing_date DATE,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE order_pricing IS '订单价格信息表，存储订单金额和计费显示数据';
COMMENT ON COLUMN order_pricing.transaction_id IS '交易ID（关联 orders 表）';
COMMENT ON COLUMN order_pricing.order_cny_value IS '订单原始人民币金额';
COMMENT ON COLUMN order_pricing.order_ex_rate IS '订单汇率（非美元汇率，不用于计费）';
COMMENT ON COLUMN order_pricing.currency IS '币种（默认 USD）';
COMMENT ON COLUMN order_pricing.cog_usd IS '⚡ COG USD 显示值（触发器同步）';
COMMENT ON COLUMN order_pricing.shipping_usd IS '⚡ Shipping USD 显示值（触发器同步）';
COMMENT ON COLUMN order_pricing.fulfillment_usd IS '⚡ Fulfillment USD 显示值（触发器同步）';
COMMENT ON COLUMN order_pricing.total_cost_usd IS '⚡ 总成本 USD 显示值（触发器同步）';
COMMENT ON COLUMN order_pricing.ex_rate_used IS '⚡ 实际使用的汇率（触发器同步）';
COMMENT ON COLUMN order_pricing.billing_date IS '⚡ 账单日期（仅 bill_issued=true 时同步）';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_order_pricing_currency ON order_pricing(currency);

-- =====================================================
-- 步骤 2: 迁移数据到 order_pricing
-- =====================================================
INSERT INTO order_pricing (
    transaction_id,
    order_cny_value, order_ex_rate, currency,
    cog_usd, shipping_usd, fulfillment_usd, total_cost_usd,
    ex_rate_used, billing_date,
    updated_at
)
SELECT 
    transaction_id,
    order_cny_value, order_ex_rate, currency,
    cog_usd, shipping_usd, fulfillment_usd, total_cost_usd,
    ex_rate_used, billing_date,
    updated_at
FROM orders;

DO $$
DECLARE
    orders_count INTEGER;
    pricing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orders_count FROM orders;
    SELECT COUNT(*) INTO pricing_count FROM order_pricing;
    
    IF orders_count != pricing_count THEN
        RAISE EXCEPTION '数据迁移数量不匹配! orders: %, order_pricing: %', orders_count, pricing_count;
    END IF;
    
    RAISE NOTICE '数据迁移成功: % 条记录', pricing_count;
END $$;

-- =====================================================
-- 步骤 3: 从 orders 表删除价格相关列
-- =====================================================
ALTER TABLE orders DROP COLUMN IF EXISTS order_cny_value;
ALTER TABLE orders DROP COLUMN IF EXISTS order_ex_rate;
ALTER TABLE orders DROP COLUMN IF EXISTS currency;
ALTER TABLE orders DROP COLUMN IF EXISTS cog_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS shipping_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS fulfillment_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS total_cost_usd;
ALTER TABLE orders DROP COLUMN IF EXISTS ex_rate_used;
ALTER TABLE orders DROP COLUMN IF EXISTS billing_date;

RAISE NOTICE '已从 orders 表删除价格相关列';

-- =====================================================
-- 步骤 4: 更新触发器函数 - 同步目标改为 order_pricing
-- =====================================================
CREATE OR REPLACE FUNCTION sync_billing_to_orders()
RETURNS TRIGGER AS $$
BEGIN
    -- 同步到 order_pricing 表（原来是 orders 表）
    UPDATE order_pricing op
    SET 
        -- COG USD
        cog_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.cog_billed_usd
            WHEN NEW.cog_cny IS NOT NULL THEN
                ROUND(
                    (NEW.cog_cny + COALESCE(NEW.cog_premium_cny, 0)) / 
                    COALESCE(
                        NEW.ex_rate_used,
                        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                        get_default_exchange_rate(),
                        6.75
                    ),
                2)
            ELSE NULL
        END,
        
        -- Shipping USD
        shipping_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.freight_billed_usd
            WHEN NEW.freight_est_cny IS NOT NULL THEN
                ROUND(
                    NEW.freight_est_cny / 
                    COALESCE(
                        NEW.ex_rate_used,
                        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                        get_default_exchange_rate(),
                        6.75
                    ),
                2)
            ELSE NULL
        END,
        
        -- Fulfillment USD
        fulfillment_usd = NEW.fulfillment_usd,
        
        -- Billing Date: 仅 bill_issued = true 时同步
        billing_date = CASE 
            WHEN NEW.bill_issued = true THEN NEW.billing_date
            ELSE NULL
        END,
        
        -- Total Cost USD
        total_cost_usd = CASE 
            WHEN NEW.bill_issued = true THEN NEW.total_cost_usd
            WHEN NEW.cog_cny IS NOT NULL THEN
                ROUND(
                    ((NEW.cog_cny + COALESCE(NEW.cog_premium_cny, 0)) / 
                     COALESCE(
                         NEW.ex_rate_used,
                         (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                         get_default_exchange_rate(),
                         6.75
                     )) +
                    (CASE 
                        WHEN NEW.freight_est_cny IS NOT NULL THEN 
                            NEW.freight_est_cny / 
                            COALESCE(
                                NEW.ex_rate_used,
                                (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                                get_default_exchange_rate(),
                                6.75
                            )
                        ELSE 0 
                    END) +
                    COALESCE(NEW.fulfillment_usd, 0),
                2)
            ELSE NULL
        END,
        
        -- ex_rate_used
        ex_rate_used = COALESCE(
            NEW.ex_rate_used,
            (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
            get_default_exchange_rate(),
            6.75
        ),
        
        -- 更新时间
        updated_at = NOW()
    WHERE op.transaction_id = NEW.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_billing_to_orders IS '自动同步 order_billing 的显示字段到 order_pricing 表';

-- =====================================================
-- 步骤 5: 更新 get_default_exchange_rate() 函数
-- =====================================================
CREATE OR REPLACE FUNCTION get_default_exchange_rate() 
RETURNS NUMERIC(10,4) AS $$
DECLARE
    default_rate NUMERIC(10,4);
BEGIN
    -- 从 order_pricing 表中计算平均汇率（原来是 orders 表）
    SELECT COALESCE(
        AVG(ex_rate_used),
        6.75
    ) INTO default_rate
    FROM order_pricing
    WHERE ex_rate_used IS NOT NULL;
    
    RETURN ROUND(default_rate, 4);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_default_exchange_rate IS '获取默认汇率，基于历史 order_pricing 中账单汇率的平均值';

-- =====================================================
-- 步骤 6: 更新视图 orders_with_billing_display
-- =====================================================
CREATE OR REPLACE VIEW orders_with_billing_display AS
SELECT 
    o.transaction_id,
    o.order_number,
    o.store_name,
    o.order_date,
    o.dispatch_date,
    o.order_status,
    o.country,
    o.abnormal_code,
    o.remarks,
    o.is_abnormal,
    
    -- 价格字段来自 order_pricing
    op.order_cny_value,
    op.order_ex_rate,
    op.currency,
    
    -- Billing 字段
    op.billing_date,
    ob.bill_issued,
    op.ex_rate_used,
    
    -- 实际使用的汇率
    COALESCE(
        op.ex_rate_used,
        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
        get_default_exchange_rate(),
        6.75
    ) as effective_ex_rate,
    
    -- COG USD
    op.cog_usd,
    
    -- Shipping USD
    op.shipping_usd,
    
    -- Fulfillment USD
    op.fulfillment_usd,
    
    -- Total Cost USD
    op.total_cost_usd
    
FROM orders o
LEFT JOIN order_pricing op ON o.transaction_id = op.transaction_id
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id;

COMMENT ON VIEW orders_with_billing_display IS '订单显示视图，关联 order_pricing 获取价格数据，关联 order_billing 获取账单状态';

-- =====================================================
-- 步骤 7: 验证
-- =====================================================
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    -- 验证 order_pricing 表存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'order_pricing'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        RAISE EXCEPTION 'order_pricing 表未创建!';
    END IF;
    RAISE NOTICE '✓ order_pricing 表创建成功';
    
    -- 验证 orders 表已删除价格列
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'order_cny_value'
    ) INTO col_exists;
    
    IF col_exists THEN
        RAISE EXCEPTION 'orders 表中 order_cny_value 列未删除!';
    END IF;
    RAISE NOTICE '✓ orders 表价格列已删除';
    
    -- 验证数据迁移
    DECLARE
        orders_count INTEGER;
        pricing_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO orders_count FROM orders;
        SELECT COUNT(*) INTO pricing_count FROM order_pricing;
        
        IF orders_count != pricing_count THEN
            RAISE EXCEPTION '数据量不匹配! orders: %, order_pricing: %', orders_count, pricing_count;
        END IF;
        RAISE NOTICE '✓ 数据迁移验证通过: % 条记录', pricing_count;
    END;
    
    -- 验证视图可查询
    PERFORM * FROM orders_with_billing_display LIMIT 1;
    RAISE NOTICE '✓ 视图 orders_with_billing_display 可正常查询';
    
    RAISE NOTICE '所有验证通过！';
END $$;

COMMIT;
