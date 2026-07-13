begin;
create extension if not exists pgtap;
select plan(3);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000000','a7000000-0000-4000-8000-000000000001','authenticated','authenticated','audit-mgr@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000000','a7000000-0000-4000-8000-000000000002','authenticated','authenticated','audit-emp@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable)
values
 ('a7100000-0000-4000-8000-000000000001','audit-mgr','Audit Manager','owner','audit-mgr@example.invalid','a7000000-0000-4000-8000-000000000001','active',false),
 ('a7100000-0000-4000-8000-000000000002','audit-emp','Audit Employee','stylist','audit-emp@example.invalid','a7000000-0000-4000-8000-000000000002','active',true);

insert into public.staff_security_audit (id,actor_staff_id,target_staff_id,action,before_state,after_state)
values
 ('a7200000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000002','role_changed',
  jsonb_build_object('role','stylist'), jsonb_build_object('role','manager'));

-- Employee context: RLS must hide the audit log entirely (grant is present, so
-- this is a zero-row result, not a permission error).
set local role authenticated;
select set_config('request.jwt.claim.sub','a7000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);

select is(
  (select count(*)::int from public.staff_security_audit),
  0, 'non-managers see no audit rows'
);

-- Manager context: grant + RLS policy allow reading the log.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a7000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

select is(
  (select count(*)::int from public.staff_security_audit where id='a7200000-0000-4000-8000-000000000001'),
  1, 'managers can read audit rows'
);
select is(
  (select action from public.staff_security_audit where id='a7200000-0000-4000-8000-000000000001'),
  'role_changed', 'audit action is readable by managers'
);

reset role;
select * from finish();
rollback;