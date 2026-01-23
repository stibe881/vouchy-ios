-- REBUILD INVITATION SYSTEM V2
-- This script resets and repairs the entire invitation logic.

-- 1. CLEANUP: Remove old functions/policies to avoid conflicts
DROP FUNCTION IF EXISTS add_member_to_family(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS accept_family_invite(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS debug_get_invites(TEXT);
DROP POLICY IF EXISTS "Invited users can view family details" ON families;
DROP POLICY IF EXISTS "Users can update own invites" ON family_invites;
DROP POLICY IF EXISTS "Users can view own invites" ON family_invites;

-- 2. SCHEMA REPAIR: Ensure families table has correct structure
ALTER TABLE families ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb;
ALTER TABLE families ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 1;

-- 3. RLS POLICIES (Simplified & Robust)

-- Profiles: Publicly readable (authenticated)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Family Invites: Visible if you sent it OR if it's sent to your email (case-insensitive)
DROP POLICY IF EXISTS "View invites" ON family_invites;
CREATE POLICY "View invites" ON family_invites
  FOR SELECT USING (
    lower(invitee_email) = lower(auth.jwt() ->> 'email') OR
    inviter_id = auth.uid()
  );

-- Family Invites: Update only if it's your email
DROP POLICY IF EXISTS "Update invites" ON family_invites;
CREATE POLICY "Update invites" ON family_invites
  FOR UPDATE USING (
    lower(invitee_email) = lower(auth.jwt() ->> 'email')
  );

-- Families: Visible if you are in the members JSON OR if you have a pending/accepted invite
-- This ensures visibility survives the transition from pending -> accepted
DROP POLICY IF EXISTS "View families" ON families;
CREATE POLICY "View families" ON families
  FOR SELECT USING (
    -- Case 1: Already a member (check JSON)
    exists (
      select 1 from jsonb_array_elements(members) as m
      where lower(m->>'email') = lower(auth.jwt() ->> 'email')
    )
    OR
    -- Case 2: Has an invite (pending or accepted)
    exists (
      select 1 from family_invites
      where family_invites.family_id = families.id
      and lower(family_invites.invitee_email) = lower(auth.jwt() ->> 'email')
    )
    OR
    -- Case 3: Owner (fallback)
    user_id = auth.uid()
  );

-- 4. ATOMIC ACCEPT FUNCTION (The only RPC we need)
CREATE OR REPLACE FUNCTION handle_invite_acceptance(
  p_invite_id UUID,
  p_user_email TEXT,
  p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin to bypass update restrictions on families table
AS $$
DECLARE
  v_invite family_invites%ROWTYPE;
  v_family RECORD;
  v_members JSONB;
  v_is_member BOOLEAN := false;
  v_new_member JSONB;
BEGIN
  -- 1. Get Invite
  SELECT * INTO v_invite FROM family_invites WHERE id = p_invite_id;
  
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found');
  END IF;

  -- 2. Verify Email ownership
  IF lower(v_invite.invitee_email) != lower(p_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email mismatch');
  END IF;

  -- 3. Get Family Members
  SELECT * INTO v_family FROM families WHERE id = v_invite.family_id;
  
  -- Handle missing members column gracefully if select * failed to catch it (shouldn't happen with Row types but JSONB extraction is safer)
  v_members := to_jsonb(v_family)->'members';
  
  IF v_members IS NULL OR jsonb_typeof(v_members) = 'null' THEN
    v_members := '[]'::jsonb;
  END IF;

  -- 4. Check if already member
  IF jsonb_path_exists(v_members, format('$[*] ? (@.email == "%s")', lower(p_user_email))::jsonpath) THEN
     v_is_member := true;
  END IF;

  -- 5. Add Member
  IF NOT v_is_member THEN
     v_new_member := jsonb_build_object(
        'id', substr(md5(random()::text), 0, 9),
        'email', lower(p_user_email),
        'name', p_user_name
     );
     -- Append
     v_members := v_members || v_new_member;
     
     -- Update Family
     UPDATE families 
     SET members = v_members, 
         member_count = jsonb_array_length(v_members)
     WHERE id = v_invite.family_id;
  END IF;

  -- 6. Update Invite Status
  UPDATE family_invites 
  SET status = 'accepted', updated_at = NOW() 
  WHERE id = p_invite_id;

  RETURN jsonb_build_object('success', true, 'family_id', v_invite.family_id);
END;
$$;
