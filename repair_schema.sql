-- Add the missing 'members' column to the 'families' table
-- This column is required for storing the list of family members as a JSON array.

ALTER TABLE families 
ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb;

-- Ensure member_count also exists and defaults to 1 (owner) if null
ALTER TABLE families 
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 1;

-- Update existing rows to have at least an empty array if currently null
UPDATE families 
SET members = '[]'::jsonb 
WHERE members IS NULL;
