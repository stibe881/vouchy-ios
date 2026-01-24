-- LÖSUNG: Übertrage alle Gutscheine der Familie "Gross" auf bine89@hotmail.com
-- Schritt 1: Lösche alle Duplikate
-- Schritt 2: Übertrage Originale auf bine

-- 1. Lösche ALLE Duplikate (die bei bine erstellt wurden)
WITH bine_user AS (
    SELECT id FROM profiles WHERE lower(email) = 'bine89@hotmail.com'
),
gross_family AS (
    SELECT id FROM families WHERE name ILIKE '%gross%' LIMIT 1
)
DELETE FROM vouchers
WHERE user_id = (SELECT id FROM bine_user)
AND family_id = (SELECT id FROM gross_family);

-- 2. Übertrage ALLE Gutscheine der Familie "Gross" auf bine
WITH bine_user AS (
    SELECT id FROM profiles WHERE lower(email) = 'bine89@hotmail.com'
),
gross_family AS (
    SELECT id FROM families WHERE name ILIKE '%gross%' LIMIT 1
)
UPDATE vouchers
SET user_id = (SELECT id FROM bine_user)
WHERE family_id = (SELECT id FROM gross_family);

-- 3. Zeige alle Gutscheine der Familie "Gross" (sollten jetzt alle bine gehören)
SELECT 
    v.id,
    v.title as voucher_title,
    v.store,
    p.email as owner_email,
    f.name as family_name,
    v.created_at
FROM vouchers v
LEFT JOIN profiles p ON v.user_id = p.id
LEFT JOIN families f ON v.family_id = f.id
WHERE v.family_id IN (SELECT id FROM families WHERE name ILIKE '%gross%')
ORDER BY v.created_at DESC;

-- ========================================
-- WICHTIG: 
-- ========================================
-- Nach diesem Skript gehören ALLE Gutscheine der Familie "Gross" zu bine.
-- Du (stefan) kannst sie dann NICHT MEHR bearbeiten/löschen!
-- 
-- Wenn das App-Update durch ist, kannst du die Gutscheine zurückübertragen:
/*
WITH stefan_user AS (
    SELECT id FROM profiles WHERE lower(email) = 'stefan.gross@hotmail.ch'
),
gross_family AS (
    SELECT id FROM families WHERE name ILIKE '%gross%' LIMIT 1
)
UPDATE vouchers
SET user_id = (SELECT id FROM stefan_user)
WHERE family_id = (SELECT id FROM gross_family);
*/
