-- Add RLS Policy for Family Voucher Visibility
-- Run this in Supabase SQL Editor

-- First, check if RLS is enabled on vouchers table
-- If this returns 'f' (false), you don't need the policy
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'vouchers' AND schemaname = 'public';

-- If RLS is enabled (rowsecurity = 't'), run the following:

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own vouchers" ON vouchers;
DROP POLICY IF EXISTS "Users can view family vouchers" ON vouchers;

-- Create comprehensive policy for viewing vouchers
CREATE POLICY "Users can view own and family vouchers" ON vouchers
  FOR SELECT USING (
    -- Own vouchers
    auth.uid() = user_id
    OR
    -- Family vouchers (where user is in the members JSONB array)
    EXISTS (
      SELECT 1 FROM families f,
      jsonb_array_elements(f.members) as m
      WHERE f.id = vouchers.family_id
      AND lower(m->>'email') = lower(auth.jwt()->>'email')
    )
  );

-- Ensure users can still insert/update/delete their own vouchers
DROP POLICY IF EXISTS "Users can insert own vouchers" ON vouchers;
CREATE POLICY "Users can insert own vouchers" ON vouchers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vouchers" ON vouchers;
CREATE POLICY "Users can update own vouchers" ON vouchers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own vouchers" ON vouchers;
CREATE POLICY "Users can delete own vouchers" ON vouchers
  FOR DELETE USING (auth.uid() = user_id);
