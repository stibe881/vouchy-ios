-- SOFORT-LÖSUNG: RLS-Policy für Familien-Gutscheine
-- Führe dies in Supabase SQL Editor aus, damit bine89@hotmail.com sofort die Gutscheine sieht

-- 1. Aktiviere RLS auf vouchers (falls noch nicht aktiv)
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- 2. Lösche bestehende SELECT-Policies für vouchers
DROP POLICY IF EXISTS "Users can view own vouchers" ON vouchers;
DROP POLICY IF EXISTS "Users can view family vouchers" ON vouchers;
DROP POLICY IF EXISTS "Users can view own and family vouchers" ON vouchers;

-- 3. Erstelle neue Policy die BEIDES erlaubt: eigene Gutscheine UND Familien-Gutscheine
CREATE POLICY "Users can view own and family vouchers" ON vouchers
  FOR SELECT USING (
    -- Eigene Gutscheine
    auth.uid() = user_id
    OR
    -- Gutscheine aus Familien, in denen der User Mitglied ist
    EXISTS (
      SELECT 1 
      FROM families f,
      jsonb_array_elements(f.members) as m
      WHERE f.id = vouchers.family_id
      AND lower(m->>'email') = lower(auth.jwt()->>'email')
    )
  );

-- 4. Stelle sicher, dass auch INSERT/UPDATE/DELETE funktionieren
DROP POLICY IF EXISTS "Users can insert own vouchers" ON vouchers;
CREATE POLICY "Users can insert own vouchers" ON vouchers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vouchers" ON vouchers;
CREATE POLICY "Users can update own vouchers" ON vouchers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own vouchers" ON vouchers;
CREATE POLICY "Users can delete own vouchers" ON vouchers
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Verification: Zeige alle aktiven Policies auf vouchers
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'vouchers';
