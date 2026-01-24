-- Prüfe die tatsächliche Struktur der vouchers-Tabelle
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vouchers' 
AND table_schema = 'public'
ORDER BY ordinal_position;
