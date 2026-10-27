-- =====================================================
-- Order Billing 表重构 - 完整迁移脚本
-- =====================================================
-- 目标: 将 billing 相关字段从 orders 表迁移到 order_billing 表
-- 作者: AI Assistant
-- 日期: 2026-08-10
-- =====================================================

-- =====================================================
-- 步骤 0: 备份现有数据（安全第一）
-- =====================================================
BEGIN;

CREATE TABLE IF NOT EXISTS orders_backup_20260810 AS 
SELECT * FROM orders;

-- 验证备份
DO $$
DECLARE
    original_count INTEGER;
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM orders;
    SELECT COUNT(*) INTO backup_count FROM orders_backup_20260810;
    
    IF original_count != backup_count THEN
        RAISE EXCEPTION 'Backup count mismatch! Original: %, Backup: %', original_count, backup_count;
    END IF;
    
    RAISE NOTICE 'Backup successful: % records', backup_count;
END $$;

-- =====================================================
-- 步骤 1: 创建 order_billing 表
-- =====================================================
CREATE TABLE IF NOT EXISTS order_billing (
    transaction_id TEXT PRIMARY KEY REFERENCES orders(transaction_id) ON DELETE CASCADE,
    
    -- CNY 原始金额
    cog_cny NUMERIC(12,2),                    -- COG 人民币金额
    cog_premium_cny NUMERIC(12,2) DEFAULT 0,  -- COG 溢价
    
    -- 运费估算（账单前）
    freight_est_cny NUMERIC(12,2),            -- 估算运费人民币
    
    -- USD 账单金额（账单后）
    cog_billed_usd NUMERIC(10,2),             -- COG 账单美元
    freight_billed_usd NUMERIC(10,2),         -- 运费账单美元
    fulfillment_usd NUMERIC(10,2),            -- Fulfillment 美元
    total_cost_usd NUMERIC(10,2),             -- 总成本美元（账单后计算并存储）
    
    -- 汇率和日期
    ex_rate_used NUMERIC(10,4),               -- 使用的汇率
    billing_date DATE,                        -- 账单日期
    
    -- 状态标记
    bill_issued BOOLEAN DEFAULT false,        -- 是否已出账（手动设置）
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE order_billing IS '订单账单信息表，存储 COG、运费、fulfillment 等计费数据';
COMMENT ON COLUMN order_billing.cog_cny IS 'COG 人民币金额（来自订单）';
COMMENT ON COLUMN order_billing.cog_premium_cny IS 'COG 溢价人民币';
COMMENT ON COLUMN order_billing.freight_est_cny IS '估算运费人民币（账单前使用）';
COMMENT ON COLUMN order_billing.cog_billed_usd IS 'COG 账单美元（账单后显示）';
COMMENT ON COLUMN order_billing.freight_billed_usd IS '运费账单美元（账单后显示）';
COMMENT ON COLUMN order_billing.fulfillment_usd IS 'Fulfillment 费用美元';
COMMENT ON COLUMN order_billing.total_cost_usd IS '总成本美元（cog_billed_usd + freight_billed_usd + fulfillment_usd，账单后计算并存储）';
COMMENT ON COLUMN order_billing.ex_rate_used IS '账单使用的汇率';
COMMENT ON COLUMN order_billing.billing_date IS '账单日期';
COMMENT ON COLUMN order_billing.bill_issued IS '是否已出账（true=显示 billed 价格，false=显示估算价格）';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_order_billing_bill_issued ON order_billing(bill_issued);
CREATE INDEX IF NOT EXISTS idx_order_billing_billing_date ON order_billing(billing_date);
CREATE INDEX IF NOT EXISTS idx_order_billing_transaction_id ON order_billing(transaction_id);

-- =====================================================
-- 步骤 2: 创建辅助函数和配置表（必须在 View 之前）
-- =====================================================

-- 2.1 获取默认汇率的函数（View 需要引用此函数）
CREATE OR REPLACE FUNCTION get_default_exchange_rate() 
RETURNS NUMERIC(10,4) AS $$
DECLARE
    default_rate NUMERIC(10,4);
BEGIN
    -- 从已有数据中计算平均汇率作为默认值
    -- 只使用 ex_rate_used（账单汇率），不使用 order_ex_rate（可能不是美元汇率）
    SELECT COALESCE(
        AVG(ex_rate_used),
        6.75  -- 兜底值
    ) INTO default_rate
    FROM orders
    WHERE ex_rate_used IS NOT NULL;
    
    RETURN ROUND(default_rate, 4);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_default_exchange_rate IS '获取默认汇率，基于历史账单汇率的平均值';

-- 2.2 创建默认汇率常量表（可选，用于手动配置）
CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认汇率配置
INSERT INTO system_config (config_key, config_value, description)
VALUES (
    'default_exchange_rate',
    '6.75',
    'Default USD/CNY exchange rate when ex_rate_used is NULL'
)
ON CONFLICT (config_key) DO NOTHING;

COMMENT ON TABLE system_config IS '系统配置表，存储全局配置参数';

-- 2.3 更新 bill_issued 状态的函数
CREATE OR REPLACE FUNCTION update_bill_issued_status(p_transaction_id TEXT, p_bill_issued BOOLEAN)
RETURNS VOID AS $$
BEGIN
    UPDATE order_billing
    SET 
        bill_issued = p_bill_issued,
        updated_at = NOW()
    WHERE transaction_id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order billing record not found for transaction_id: %', p_transaction_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_bill_issued_status IS '手动更新订单的 bill_issued 状态';

-- 2.4 批量设置 bill_issued 的函数
CREATE OR REPLACE FUNCTION batch_update_bill_issued(p_transaction_ids TEXT[], p_bill_issued BOOLEAN)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE order_billing
    SET 
        bill_issued = p_bill_issued,
        updated_at = NOW()
    WHERE transaction_id = ANY(p_transaction_ids);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_update_bill_issued IS '批量更新多个订单的 bill_issued 状态';

-- =====================================================
-- 步骤 3: 创建 View - orders_with_billing_display
-- =====================================================
-- 这个 view 用于前端显示，根据 bill_issued 自动选择显示 billed 或 estimated 价格
-- 当 ex_rate_used 为 NULL 时，使用配置文件的 default_ex_rate

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
    o.order_cny_value,
    o.order_ex_rate,
    
    -- Billing 字段（通过 CASE 逻辑动态计算）
    ob.billing_date,
    ob.bill_issued,
    ob.ex_rate_used,
    
    -- 实际使用的汇率（优先 ex_rate_used，其次使用配置的默认汇率）
    COALESCE(
        ob.ex_rate_used,
        (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
        get_default_exchange_rate(),
        6.75  -- 最终兜底
    ) as effective_ex_rate,
    
    -- 显示的 COG USD（根据 bill_issued 决定）
    CASE 
        WHEN ob.bill_issued = true THEN ob.cog_billed_usd
        WHEN ob.cog_cny IS NOT NULL AND (
            ob.ex_rate_used IS NOT NULL OR
            EXISTS (SELECT 1 FROM system_config WHERE config_key = 'default_exchange_rate')
        ) THEN ROUND(
            (ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / 
            COALESCE(
                ob.ex_rate_used,
                (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                get_default_exchange_rate(),
                6.75
            ), 2)
        ELSE NULL
    END as cog_usd,
    
    -- 显示的 Shipping/Freight USD
    CASE 
        WHEN ob.bill_issued = true THEN ob.freight_billed_usd
        WHEN ob.freight_est_cny IS NOT NULL AND (
            ob.ex_rate_used IS NOT NULL OR
            EXISTS (SELECT 1 FROM system_config WHERE config_key = 'default_exchange_rate')
        ) THEN ROUND(
            ob.freight_est_cny / 
            COALESCE(
                ob.ex_rate_used,
                (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                get_default_exchange_rate(),
                6.75
            ), 2)
        ELSE NULL
    END as shipping_usd,
    
    -- Fulfillment USD（始终相同）
    ob.fulfillment_usd,
    
    -- 显示的 Total Cost USD
    CASE 
        WHEN ob.bill_issued = true THEN ob.total_cost_usd  -- 直接使用存储的总成本
        WHEN ob.cog_cny IS NOT NULL AND (
            ob.ex_rate_used IS NOT NULL OR
            EXISTS (SELECT 1 FROM system_config WHERE config_key = 'default_exchange_rate')
        ) THEN
            ROUND(
                ((ob.cog_cny + COALESCE(ob.cog_premium_cny, 0)) / 
                 COALESCE(
                     ob.ex_rate_used,
                     (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                     get_default_exchange_rate(),
                     6.75
                 )) +
                (CASE 
                    WHEN ob.freight_est_cny IS NOT NULL THEN 
                        ob.freight_est_cny / 
                        COALESCE(
                            ob.ex_rate_used,
                            (SELECT config_value::NUMERIC FROM system_config WHERE config_key = 'default_exchange_rate'),
                            get_default_exchange_rate(),
                            6.75
                        )
                    ELSE 0 
                END) +
                COALESCE(ob.fulfillment_usd, 0),
            2)
        ELSE NULL
    END as total_cost_usd
    
FROM orders o
LEFT JOIN order_billing ob ON o.transaction_id = ob.transaction_id;

COMMENT ON VIEW orders_with_billing_display IS '订单显示视图，根据 bill_issued 自动选择显示 billed 或 estimated 价格，ex_rate_used 缺失时使用配置的默认汇率';

-- =====================================================
-- 步骤 4: 验证表结构和函数
-- =====================================================
DO $$
DECLARE
    check_result RECORD;
BEGIN
    -- 检查 1: order_billing 表是否存在
    SELECT COUNT(*) INTO check_result 
    FROM information_schema.tables 
    WHERE table_name = 'order_billing';
    
    IF check_result.count = 0 THEN
        RAISE EXCEPTION 'order_billing table not created!';
    ELSE
        RAISE NOTICE '✓ order_billing table created successfully';
    END IF;
    
    -- 检查 2: system_config 表是否存在
    SELECT COUNT(*) INTO check_result 
    FROM information_schema.tables 
    WHERE table_name = 'system_config';
    
    IF check_result.count = 0 THEN
        RAISE EXCEPTION 'system_config table not created!';
    ELSE
        RAISE NOTICE '✓ system_config table created successfully';
    END IF;
    
    -- 检查 3: get_default_exchange_rate 函数是否存在
    SELECT COUNT(*) INTO check_result 
    FROM pg_proc 
    WHERE proname = 'get_default_exchange_rate';
    
    IF check_result.count = 0 THEN
        RAISE EXCEPTION 'get_default_exchange_rate function not created!';
    ELSE
        RAISE NOTICE '✓ Helper functions created successfully';
    END IF;
    
    -- 检查 4: View 是否可以正常查询
    PERFORM * FROM orders_with_billing_display LIMIT 1;
    RAISE NOTICE '✓ View orders_with_billing_display created successfully';
    
    RAISE NOTICE 'All validation checks passed!';
END $$;

-- =====================================================
-- 步骤 5: 配置行级安全策略 (RLS)
-- =====================================================

-- 5.1 order_billing 表 - 启用 RLS
ALTER TABLE order_billing ENABLE ROW LEVEL SECURITY;

-- 管理员可以访问所有账单数据
CREATE POLICY "Admins can view all billing records"
ON order_billing
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

-- 管理员可以管理所有账单数据
CREATE POLICY "Admins can manage all billing records"
ON order_billing
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

COMMENT ON POLICY "Admins can view all billing records" ON order_billing IS '管理员可以查看所有订单账单数据';
COMMENT ON POLICY "Admins can manage all billing records" ON order_billing IS '管理员可以管理所有订单账单数据';

-- 5.2 system_config 表 - 启用 RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 只有管理员可以查看和修改系统配置
CREATE POLICY "Admins can view system config"
ON system_config
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Admins can manage system config"
ON system_config
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

COMMENT ON POLICY "Admins can view system config" ON system_config IS '只有管理员可以查看系统配置';
COMMENT ON POLICY "Admins can manage system config" ON system_config IS '只有管理员可以管理系统配置';

-- 验证 RLS 策略已启用
DO $$
DECLARE
    rls_enabled BOOLEAN;
BEGIN
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = 'order_billing';
    
    IF rls_enabled THEN
        RAISE NOTICE '✓ Row Level Security policies configured successfully';
    ELSE
        RAISE EXCEPTION 'RLS not enabled on order_billing table!';
    END IF;
END $$;

-- =====================================================
-- 提交事务
-- =====================================================
COMMIT;
