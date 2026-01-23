-- DUMP ALL DATA for inspection
-- Run this to see exactly what is stored in the database.

-- 1. List all Profiles (Users)
SELECT id, email, name FROM profiles;

-- 2. List all Invites
SELECT id, invitee_email, inviter_id, status FROM family_invites;

-- 3. List all Families
SELECT id, name, members FROM families;
