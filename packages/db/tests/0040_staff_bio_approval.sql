-- Bio approval workflow tests (shape + RPC contracts).

select plan(8);

select has_column('public', 'staff', 'bio_pending', 'bio_pending column exists');
select has_column('public', 'staff', 'bio_status', 'bio_status column exists');

select has_function('public', 'submit_own_staff_bio', array['text']);
select has_function('public', 'review_staff_bio', array['uuid', 'text', 'text']);

-- Unauthenticated submit must fail.
select throws_ok(
  $$select public.submit_own_staff_bio('Hello world')$$,
  '42501',
  null,
  'submit_own_staff_bio requires auth'
);

-- Unauthenticated review must fail.
select throws_ok(
  $$select public.review_staff_bio('a1000001-0001-4000-8000-000000000001'::uuid, 'approve', null)$$,
  '42501',
  null,
  'review_staff_bio requires manager'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'staff_bio_status_check'
  ),
  'staff_bio_status_check constraint exists'
);

select is(
  (select bio_status from information_schema.columns
   where table_schema = 'public' and table_name = 'staff' and column_name = 'bio_status'
   limit 1) is not null,
  true,
  'bio_status is a real column'
);

select * from finish();
