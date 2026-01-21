-- Remove the foreign key constraint that points to the 'trips' table
-- This is necessary because we are now linking to the 'ausfluege' table (legacy) 
-- to ensure compatibility with the Ausflugfinder App's deep links.

ALTER TABLE vouchers
DROP CONSTRAINT IF EXISTS vouchers_trip_id_fkey;

-- Optional: You could add a constraint to ausfluege if you wanted, 
-- but for loose coupling/migration flexibility, no constraint is fine for now.
-- ALTER TABLE vouchers ADD CONSTRAINT vouchers_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES ausfluege(id);
