-- Debug function to check invites bypassing RLS
-- Run this in SQL Editor, then check results via Dashboard or call it.

CREATE OR REPLACE FUNCTION debug_get_invites(p_email TEXT)
RETURNS TABLE (
  found_id UUID,
  found_email TEXT,
  found_status TEXT,
  found_family_id UUID,
  can_see_rls BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id, 
    invitee_email, 
    status, 
    family_id,
    (lower(invitee_email) = lower(p_email)) as match_check
  FROM family_invites
  WHERE lower(invitee_email) = lower(p_email);
END;
$$;
