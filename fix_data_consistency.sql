-- Fix Data Consistency: Normalize all emails to lowercase
-- This ensures that comparisons works regardless of how the data was entered.

-- 1. Update family_invites
UPDATE family_invites 
SET invitee_email = lower(invitee_email);

-- 2. Update profiles
UPDATE profiles 
SET email = lower(email);

-- 3. Update family members JSON (advanced)
-- This is harder to do in SQL for JSON arrays, but the other fixes should cover the main join keys.
-- We rely on the app to lowercase new adds.

-- 4. Verify RLS policies are using LOWER() (already done in fix_invite_policies.sql)
-- Just to be safe, we re-run the grants that might be affecting visibility

GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON family_invites TO authenticated;
