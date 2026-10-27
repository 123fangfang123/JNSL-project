-- Migration: Replace freight.premium with freight.duty
-- Date: 2026-10-21
-- Description: Remove the premium column and add a duty (tariff) column to the freight table

-- Step 1: Add the new duty column
ALTER TABLE freight ADD COLUMN IF NOT EXISTS duty NUMERIC;

-- Step 2: Drop the premium column
ALTER TABLE freight DROP COLUMN IF EXISTS premium;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN freight.duty IS '关税金额';
