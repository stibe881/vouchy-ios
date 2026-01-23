-- Create a secure function to add a member to a family
-- This bypasses RLS for the update, ensuring safety and preventing permission errors

CREATE OR REPLACE FUNCTION add_member_to_family(
  p_family_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_member_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with admin privileges
AS $$
DECLARE
  v_current_members JSONB;
  v_new_member JSONB;
BEGIN
  -- 1. Fetch current members
  SELECT members INTO v_current_members
  FROM families
  WHERE id = p_family_id;

  -- Initialize if null
  IF v_current_members IS NULL THEN
    v_current_members := '[]'::jsonb;
  END IF;

  -- 2. Create new member object
  v_new_member := jsonb_build_object(
    'id', p_member_id,
    'email', lower(p_email),
    'name', p_name
  );

  -- 3. Update the family
  -- Use coalesce to handle null logic safely, append new member
  UPDATE families
  SET 
    members = v_current_members || v_new_member,
    member_count = jsonb_array_length(v_current_members || v_new_member)
  WHERE id = p_family_id;
  
END;
$$;
