-- Check Invites for Specific Emails
-- Does a pending invite exist for these users?

SELECT * FROM family_invites 
WHERE lower(invitee_email) LIKE '%stefan.gross%';
