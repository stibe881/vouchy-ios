-- WIPE DATA SCRIPT (PROPER CLEANUP)
-- Deletes ALL families, invites, and notifications to ensure a completely clean slate.

-- 1. Delete ALL family invites (Pending, Accepted, Rejected)
DELETE FROM family_invites;

-- 2. Delete ALL families
DELETE FROM families;

-- 3. Delete ALL notifications (to remove "You have an invite" messages for deleted invites)
DELETE FROM notifications;

-- Verify empty state
SELECT count(*) as invites_remaining FROM family_invites;
SELECT count(*) as families_remaining FROM families;
