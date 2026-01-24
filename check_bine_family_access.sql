-- Diagnose: Warum sieht bine89@hotmail.com keine Gutscheine der Familie "Gross"?

-- 1. Finde die Familie "Gross"
SELECT 
    id as family_id,
    name,
    user_id as creator_id,
    members,
    member_count,
    created_at
FROM families
WHERE name ILIKE '%gross%';

-- 2. Prüfe, ob bine89@hotmail.com in der members-Liste ist
SELECT 
    f.id as family_id,
    f.name as family_name,
    m->>'email' as member_email,
    m->>'name' as member_name,
    m->>'id' as member_id
FROM families f,
jsonb_array_elements(f.members) as m
WHERE f.name ILIKE '%gross%';

-- 3. Prüfe Einladungen für bine89@hotmail.com
SELECT 
    fi.id as invite_id,
    fi.status,
    fi.invitee_email,
    fi.created_at,
    f.name as family_name,
    f.id as family_id
FROM family_invites fi
JOIN families f ON fi.family_id = f.id
WHERE lower(fi.invitee_email) = 'bine89@hotmail.com'
ORDER BY fi.created_at DESC;

-- 4. Alle Gutscheine der Familie "Gross"
SELECT 
    v.id as voucher_id,
    v.name as voucher_name,
    v.user_id as creator_id,
    v.family_id,
    v.created_at,
    f.name as family_name
FROM vouchers v
JOIN families f ON v.family_id = f.id
WHERE f.name ILIKE '%gross%'
ORDER BY v.created_at DESC;

-- 5. LÖSUNG: Füge bine89@hotmail.com zur Familie "Gross" hinzu (nur ausführen wenn nötig!)
-- Uncomment und führe aus, wenn bine89 NICHT in der members-Liste ist:

/*
-- Finde zuerst die family_id der Familie "Gross"
DO $$
DECLARE
    v_family_id UUID;
    v_family RECORD;
    v_members JSONB;
    v_new_member JSONB;
    v_is_member BOOLEAN := false;
BEGIN
    -- Familie finden
    SELECT id, members INTO v_family_id, v_members
    FROM families 
    WHERE name ILIKE '%gross%'
    LIMIT 1;
    
    IF v_family_id IS NULL THEN
        RAISE EXCEPTION 'Familie "Gross" nicht gefunden';
    END IF;
    
    -- Prüfen ob bereits Mitglied
    IF v_members IS NULL THEN
        v_members := '[]'::jsonb;
    END IF;
    
    IF jsonb_path_exists(v_members, '$[*] ? (@.email == "bine89@hotmail.com")'::jsonpath) THEN
        RAISE NOTICE 'bine89@hotmail.com ist bereits Mitglied';
        v_is_member := true;
    END IF;
    
    -- Nur hinzufügen wenn noch nicht Mitglied
    IF NOT v_is_member THEN
        v_new_member := jsonb_build_object(
            'id', substr(md5(random()::text), 0, 9),
            'email', 'bine89@hotmail.com',
            'name', 'Bine'
        );
        
        v_members := v_members || v_new_member;
        
        UPDATE families 
        SET members = v_members,
            member_count = jsonb_array_length(v_members)
        WHERE id = v_family_id;
        
        RAISE NOTICE 'bine89@hotmail.com wurde zur Familie "Gross" hinzugefügt';
    END IF;
END $$;
*/
