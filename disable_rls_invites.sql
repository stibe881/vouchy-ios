-- Debug: Temporarily disable RLS on family_invites to confirm it's the culprit
ALTER TABLE family_invites DISABLE ROW LEVEL SECURITY;

-- If this makes the invite assume, then we KNOW the policy is wrong.
-- (Don't forget to re-enable it later for production safety, but for now we debug)
