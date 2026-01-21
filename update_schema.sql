-- Run this in your Supabase SQL Editor to update the database schema

-- 1. VOUCHERS Table Updates
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS image_url_2 TEXT;

-- 2. PROFILES Table Updates (for Notifications)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 3. NOTIFICATIONS Table (Create if not exists)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'success', 'warning'
  read BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on notifications if created
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users can see own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Everyone can insert notifications (needed for system/other users to notify)
-- Or strictly: Users can insert for themselves or system/functions handle it. 
-- For simplicity in this app:
CREATE POLICY "Users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
