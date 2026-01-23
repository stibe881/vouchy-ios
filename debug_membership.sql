-- Debug Membership Function
-- Lists all families and whether the user is in the members JSON or has an invite

CREATE OR REPLACE FUNCTION debug_check_membership(p_email TEXT)
RETURNS TABLE (
  family_id UUID,
  family_name TEXT,
  member_count INTEGER,
  is_in_members_array BOOLEAN,
  has_invite BOOLEAN,
  invite_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.member_count,
    -- Check if email exists in the members JSON array
    EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(f.members, '[]'::jsonb)) as m
        WHERE lower(m->>'email') = lower(p_email)
    ) as is_in_members_array,
    -- Check if there is an invite
    (i.id IS NOT NULL) as has_invite,
    i.status as invite_status
  FROM families f
  LEFT JOIN family_invites i ON i.family_id = f.id AND lower(i.invitee_email) = lower(p_email);
END;
$$;
