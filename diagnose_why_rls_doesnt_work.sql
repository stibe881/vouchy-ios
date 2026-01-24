-- DIAGNOSE: Warum sieht bine89@hotmail.com keine Gutscheine?

-- 1. Finde bine's user_id
SELECT 
    id as user_id,
    email,
    name
FROM profiles
WHERE lower(email) = 'bine89@hotmail.com';

-- 2. Welche Familien hat bine?
SELECT 
    f.id as family_id,
    f.name as family_name,
    f.members
FROM families f,
jsonb_array_elements(f.members) as m
WHERE lower(m->>'email') = 'bine89@hotmail.com';

-- 3. Gutscheine der Familie "Gross" - WER IST DER CREATOR?
SELECT 
    v.id as voucher_id,
    v.name as voucher_name,
    v.user_id as creator_user_id,
    p.email as creator_email,
    v.family_id,
    f.name as family_name
FROM vouchers v
LEFT JOIN families f ON v.family_id = f.id
LEFT JOIN profiles p ON v.user_id = p.id
WHERE f.name ILIKE '%gross%'
ORDER BY v.created_at DESC;

-- 4. Simuliere die ALTE APP-Query für bine (nur user_id filter)
-- Replace 'BINE_USER_ID_HERE' mit der tatsächlichen user_id aus Query 1
WITH bine_user AS (
    SELECT id FROM profiles WHERE lower(email) = 'bine89@hotmail.com'
)
SELECT 
    v.id,
    v.name,
    v.user_id,
    'Diese Gutscheine sieht bine mit ALTEM Code' as note
FROM vouchers v
WHERE v.user_id = (SELECT id FROM bine_user);

-- 5. Prüfe ob RLS auf vouchers aktiviert ist
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'vouchers' AND schemaname = 'public';

-- 6. Zeige aktive RLS-Policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'vouchers';

-- ========================================
-- PROBLEM IDENTIFIZIERT:
-- Die alte App verwendet .eq('user_id', userId)
-- Das bedeutet: "Gib mir nur Gutscheine wo user_id = bine ist"
-- RLS-Policies können nur EINSCHRÄNKEN, nicht ERWEITERN!
-- 
-- Auch wenn die RLS-Policy sagt "bine darf Familien-Gutscheine sehen",
-- fragt die App nicht nach ihnen, weil sie explizit nur "user_id = bine" anfragt.
-- ========================================

-- WORKAROUND-MÖGLICHKEITEN:

-- Option A: Ändere die user_id aller Gutscheine in Familie "Gross" auf bine
-- ACHTUNG: Der ursprüngliche Creator kann sie dann nicht mehr bearbeiten!
/*
WITH bine_user AS (
    SELECT id FROM profiles WHERE lower(email) = 'bine89@hotmail.com'
),
gross_family AS (
    SELECT id FROM families WHERE name ILIKE '%gross%' LIMIT 1
)
UPDATE vouchers
SET user_id = (SELECT id FROM bine_user)
WHERE family_id = (SELECT id FROM gross_family);
*/

-- Option B: Erstelle Duplikate für bine (kompliziert, braucht Sync-Logik)
-- Nicht empfohlen

-- Option C: Warte auf App-Update (empfohlen)
-- Der neue Code wird funktionieren!
