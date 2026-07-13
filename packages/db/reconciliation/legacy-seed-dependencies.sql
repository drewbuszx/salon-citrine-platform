-- Disposable-history reconciliation only.
-- Historical migrations 0013–0015 embedded demo rows that reference staff records
-- originally loaded outside migration history. Production already has these rows;
-- canonical disposable replay inserts minimal placeholders before those migrations.
insert into public.staff (id,slug,name,role,is_bookable) values
  ('a1000001-0001-4000-8000-000000000001','legacy-lily','Legacy Lily','owner',false),
  ('a1000001-0001-4000-8000-000000000002','legacy-miriam','Legacy Miriam','owner',false),
  ('a1000001-0001-4000-8000-000000000003','legacy-andra','Legacy Andra','owner',false),
  ('a1000001-0001-4000-8000-000000000004','legacy-shelby','Legacy Shelby','stylist',false),
  ('a1000001-0001-4000-8000-000000000005','legacy-jules','Legacy Jules','stylist',false),
  ('a1000001-0001-4000-8000-000000000006','legacy-brie','Legacy Brie','stylist',false),
  ('a1000001-0001-4000-8000-000000000007','legacy-julie','Legacy Julie','esthetician',false)
on conflict (id) do nothing;
