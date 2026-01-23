-- Fix RLS policies to allow invited users to see family details and inviter profiles
-- AND allow users to insert notifications for other users

-- 1. PROFILES: Allow authenticated users to view other profiles (needed to see who invited you)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. FAMILIES: Allow users to view families they are invited to
DROP POLICY IF EXISTS "Invited users can view family details" ON families;
CREATE POLICY "Invited users can view family details" ON families
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM family_invites
      WHERE family_invites.family_id = families.id
      AND lower(family_invites.invitee_email) = lower(auth.jwt() ->> 'email')
      AND family_invites.status IN ('pending', 'accepted')
    )
  );

-- 3. FAMILY_INVITES: Ensure users can update their own invites
DROP POLICY IF EXISTS "Users can update own invites" ON family_invites;
CREATE POLICY "Users can update own invites" ON family_invites
  FOR UPDATE USING (
    lower(invitee_email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    lower(invitee_email) = lower(auth.jwt() ->> 'email')
  );

-- Ensure users can view their own invites (received) and sent invites
DROP POLICY IF EXISTS "Users can view own invites" ON family_invites;
CREATE POLICY "Users can view own invites" ON family_invites
  FOR SELECT USING (
    lower(invitee_email) = lower(auth.jwt() ->> 'email') OR
    inviter_id = auth.uid()
  );

-- 4. NOTIFICATIONS: Allow authenticated users to insert notifications for others (needed for invites)
-- Check if policy exists first to avoid error, or just drop and recreate
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
CREATE POLICY "Users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
