begin;
create extension if not exists pgtap;
select plan(11);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000001','authenticated','authenticated','hardening-stylist@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000002','authenticated','authenticated','hardening-other@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable)
values
 ('f1000000-0000-4000-8000-000000000001','hardening-stylist','Malicious <img>','stylist','hardening-stylist@example.invalid','f0000000-0000-4000-8000-000000000001','active',true),
 ('f1000000-0000-4000-8000-000000000002','hardening-other','Other Employee','esthetician','hardening-other@example.invalid','f0000000-0000-4000-8000-000000000002','active',true);

insert into public.tasks (id,title,status,assignment_type,created_by_staff_id,priority)
values
 ('f2000000-0000-4000-8000-000000000001','Hardening task','open','assigned','f1000000-0000-4000-8000-000000000001','normal'),
 ('f2000000-0000-4000-8000-000000000002','Unrelated task','open','assigned','f1000000-0000-4000-8000-000000000001','normal');
insert into public.task_assignees(task_id,staff_id)
values ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

select throws_ok(
  $$update public.staff set role = 'owner' where id = 'f1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'stylist cannot self-promote by direct update'
);
select lives_ok(
  $$select public.update_own_staff_profile('Safe Name','bio','3175550100')$$,
  'stylist can update explicitly safe profile fields'
);
select is(
  (select role from public.staff where id='f1000000-0000-4000-8000-000000000001'),
  'stylist', 'safe profile RPC cannot change role'
);
select lives_ok(
  $$select public.update_own_staff_photo('https://example.invalid/avatar.webp','{"x":0.5,"y":0.5,"scale":1.2}'::jsonb)$$,
  'stylist can update validated self-service photo fields'
);
select lives_ok(
  $$select public.complete_task('f2000000-0000-4000-8000-000000000001','done safely')$$,
  'assignee can complete eligible task'
);
select is(
  (select status from public.tasks where id='f2000000-0000-4000-8000-000000000001'),
  'done', 'completion RPC transitions to done'
);
select throws_ok(
  $$select public.complete_task('f2000000-0000-4000-8000-000000000002','tamper')$$,
  '42501', null, 'unrelated employee cannot complete task'
);
select throws_ok(
  $$select public.complete_task('f2000000-0000-4000-8000-000000000001','again')$$,
  '22023', null, 'completed task cannot transition again'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','anon',true);
select throws_ok(
  $$select phone from public.staff limit 1$$,
  '42501', null, 'anon cannot select sensitive staff columns'
);
select lives_ok(
  $$select id,slug,name,bio,photo_url,is_bookable from public.public_staff_profiles limit 1$$,
  'anon can read safe public presentation'
);
select is(
  (select count(*)::int from information_schema.columns
    where table_schema='public' and table_name='public_staff_profiles'
      and column_name in ('phone','birthday','supabase_user_id','access_status','email')),
  0, 'public projection has no sensitive columns'
);

select * from finish();
rollback;
