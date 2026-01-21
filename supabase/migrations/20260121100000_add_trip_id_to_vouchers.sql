alter table vouchers add column trip_id bigint references trips(id);
