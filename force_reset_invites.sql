-- Force Reset Invites specifically for the affected user
-- run this to make hidden/stuck invites visible again

UPDATE family_invites
SET status = 'pending', updated_at = NOW()
WHERE lower(invitee_email) = 'stefan.gross@gross-ict.ch';

-- Also ensure the email is lowercase just in case
UPDATE family_invites
SET invitee_email = lower(invitee_email)
WHERE lower(invitee_email) = 'stefan.gross@gross-ict.ch';
