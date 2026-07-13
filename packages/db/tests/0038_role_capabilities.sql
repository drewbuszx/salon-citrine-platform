begin;
create extension if not exists pgtap;
select plan(9);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-4000-8000-000000000000','c8000000-0000-4000-8000-000000000001','authenticated','authenticated','cap-owner@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000000','c8000000-0000-4000-8000-000000000002','authenticated','authenticated','cap-fd@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000000','c8000000-0000-4000-8000-000000000003','authenticated','authenticated','cap-sty@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable) values
 ('c8100000-0000-4000-8000-000000000001','cap-owner','Cap Owner','owner','cap-owner@example.invalid','c8000000-0000-4000-8000-000000000001','active',false),
 ('c8100000-0000-4000-8000-000000000002','cap-fd','Cap FrontDesk','front_desk','cap-fd@example.invalid','c8000000-0000-4000-8000-000000000002','active',false),
 ('c8100000-0000-4000-8000-000000000003','cap-sty','Cap Stylist','stylist','cap-sty@example.invalid','c8000000-0000-4000-8000-000000000003','active',true);

-- Front desk context: manager + activity viewer by seed.
set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(public.is_salon_manager(), true, 'front_desk is a manager by default');
select is(public.staff_has_capability('view_activity'), true, 'front_desk can view activity by default');
select throws_ok(
  $$select public.set_role_capability('stylist','manage_team',true)$$,
  '42501', null, 'non-owner cannot edit capabilities'
);

-- Stylist context: not a manager.
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(public.is_salon_manager(), false, 'stylist is not a manager');

-- Owner context.
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(public.is_salon_manager(), true, 'owner is always a manager');
select throws_ok(
  $$select public.set_role_capability('owner','manage_team',false)$$,
  '42501', null, 'owner cannot revoke own manage_team (anti-lockout)'
);
select lives_ok(
  $$select public.set_role_capability('front_desk','manage_team',false)$$,
  'owner can revoke front_desk manage_team'
);

-- Front desk context again: manager access is gone (proves all is_salon_manager
-- policies flip), but the unrelated view_activity capability is untouched.
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','c8000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select is(public.is_salon_manager(), false, 'front_desk loses manager access after revoke');
select is(public.staff_has_capability('view_activity'), true, 'revoking manage_team leaves view_activity intact');

reset role;
select * from finish();
rollback;