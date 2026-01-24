-- SOFORT-LÖSUNG: Erstelle Duplikate der Gutscheine für bine89@hotmail.com
-- Dies ist ein temporärer Workaround bis zum App-Update

-- 1. Erstelle Kopien aller Gutscheine der Familie "Gross" mit bine als Besitzerin
WITH bine_user AS (
    SELECT id FROM profiles WHERE lower(email) = 'bine89@hotmail.com'
),
gross_family AS (
    SELECT id FROM families WHERE name ILIKE '%gross%' LIMIT 1
),
existing_vouchers AS (
    SELECT v.*
    FROM vouchers v
    WHERE v.family_id = (SELECT id FROM gross_family)
    AND v.user_id != (SELECT id FROM bine_user)  -- Nur Gutscheine die NICHT bereits bine gehören
)
INSERT INTO vouchers (
    user_id,
    title,
    store,
    type,
    initial_amount,
    remaining_amount,
    currency,
    code,
    pin,
    expiry_date,
    notes,
    category,
    website,
    image_url,
    image_url_2,
    family_id,
    trip_id
)
SELECT 
    (SELECT id FROM bine_user) as user_id,  -- NEUE Besitzerin: bine
    ev.title,
    ev.store,
    ev.type,
    ev.initial_amount,
    ev.remaining_amount,
    ev.currency,
    ev.code,
    ev.pin,
    ev.expiry_date,
    ev.notes,
    ev.category,
    ev.website,
    ev.image_url,
    ev.image_url_2,
    ev.family_id,
    ev.trip_id
FROM existing_vouchers ev;

-- 2. Zeige die erstellten Duplikate
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
-- WICHTIG: Nach dem App-Update
-- ========================================
-- Wenn das App-Update durch ist, kannst du die Duplikate löschen:
/*
WITH bine_user AS (
    SELECT id FROM profiles WHERE lower(email) = 'bine89@hotmail.com'
),
gross_family AS (
    SELECT id FROM families WHERE name ILIKE '%gross%' LIMIT 1
)
DELETE FROM vouchers
WHERE user_id = (SELECT id FROM bine_user)
AND family_id = (SELECT id FROM gross_family);
*/
