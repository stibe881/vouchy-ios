-- Add code_pool column to vouchers table for multi-code support
-- This allows quantity vouchers to have multiple individual codes

ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS code_pool JSONB;

-- Add comment for documentation
COMMENT ON COLUMN vouchers.code_pool IS 'Array of {code: string, used: boolean, used_at?: string, used_by?: string} for multi-code quantity vouchers';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vouchers' 
AND column_name = 'code_pool';
