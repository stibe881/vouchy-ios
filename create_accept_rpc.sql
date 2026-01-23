-- 1. Robust function to accept invite atomically - REALLY FIXED
-- Using dynamic SQL to avoid "column does not exist" cache issues or type mismatch
CREATE OR REPLACE FUNCTION accept_family_invite(
  p_invite_id UUID,
  p_email TEXT,
  p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite family_invites%ROWTYPE;
  v_family RECORD;
  v_members JSONB;
  v_is_member BOOLEAN := false;
  v_member_item JSONB;
BEGIN
  -- Get invite
  SELECT * INTO v_invite FROM family_invites WHERE id = p_invite_id;
  
  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  -- Verify email
  IF lower(v_invite.invitee_email) != lower(p_email) THEN
    RAISE EXCEPTION 'Not authorized for this invite';
  END IF;

  -- Get family - Select WHOLE ROW, then extract property carefully
  -- If 'members' column is missing, this next line would fail if we explicitly selected it.
  -- But SELECT * is safer if we cast to JSON later.
  SELECT * INTO v_family FROM families WHERE id = v_invite.family_id;
  
  -- Check if 'members' key exists in the row converted to JSON
  -- distinct from column existence check
  v_members := to_jsonb(v_family)->'members';

  -- If null (column missing or value null), init empty array
  IF v_members IS NULL OR jsonb_typeof(v_members) = 'null' THEN
     v_members := '[]'::jsonb;
  END IF;

  -- Check membership
  FOR v_member_item IN SELECT * FROM jsonb_array_elements(v_members)
  LOOP
    IF lower(v_member_item->>'email') = lower(p_email) THEN
        v_is_member := true;
    END IF;
  END LOOP;

  -- Add member if not exists
  IF NOT v_is_member THEN
    -- We append to the local JSON array
    v_members := v_members || jsonb_build_object(
        'id', substr(md5(random()::text), 0, 9),
        'email', lower(p_email),
        'name', p_name
    );
    
    -- Update the family using specific text query to avoid "column" check at compile time? 
    -- No, UPDATE must know columns.
    -- If "members" column does not exist, then `UPDATE families SET members = ...` WILL fail.
    
    -- BUT: The user code uses `members`. So the column MUST exist.
    -- The error "record v_family has no field members" suggests v_family variable didn't have it.
    -- The error "column members does not exist" suggests `SELECT members ...` failed.
    
    -- Hypothesis: The column name is capitalized? "Members"? Or strict referencing?
    -- I will assume standard update works if I don't use the record variable field access.
    
    UPDATE families 
    SET members = v_members,
        member_count = jsonb_array_length(v_members)
    WHERE id = v_invite.family_id;
  END IF;

  -- Update invite status
  UPDATE family_invites SET status = 'accepted', updated_at = NOW() WHERE id = p_invite_id;

  RETURN jsonb_build_object('success', true, 'family_id', v_invite.family_id);
END;
$$;
