begin;
create extension if not exists pgtap;
select plan(30);

insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000001','authenticated','authenticated','hardening-stylist@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000002','authenticated','authenticated','hardening-other@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000003','authenticated','authenticated','hardening-owner@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000004','authenticated','authenticated','hardening-invite@example.invalid',now(),now()),
 ('00000000-0000-0000-0000-000000000000','f0000000-0000-4000-8000-000000000005','authenticated','authenticated','hardening-disabled@example.invalid',now(),now());

insert into public.staff (id,slug,name,role,email,supabase_user_id,access_status,is_bookable)
values
 ('f1000000-0000-4000-8000-000000000001','hardening-stylist','Malicious <img>','stylist','hardening-stylist@example.invalid','f0000000-0000-4000-8000-000000000001','active',true),
 ('f1000000-0000-4000-8000-000000000002','hardening-other','Other Employee','esthetician','hardening-other@example.invalid','f0000000-0000-4000-8000-000000000002','active',true),
 ('f1000000-0000-4000-8000-000000000003','hardening-owner','Owner','owner','hardening-owner@example.invalid','f0000000-0000-4000-8000-000000000003','active',false),
 ('f1000000-0000-4000-8000-000000000004','hardening-invite','Invited Employee','stylist','hardening-invite@example.invalid',null,'uninvited',false),
 ('f1000000-0000-4000-8000-000000000005','hardening-disabled','Disabled Employee','stylist','hardening-disabled@example.invalid','f0000000-0000-4000-8000-000000000005','disabled',false);

insert into public.tasks (id,title,status,assignment_type,created_by_staff_id,priority)
values
 ('f2000000-0000-4000-8000-000000000001','Hardening task','open','assigned','f1000000-0000-4000-8000-000000000001','normal'),
 ('f2000000-0000-4000-8000-000000000002','Unrelated task','open','assigned','f1000000-0000-4000-8000-000000000001','normal'),
 ('f2000000-0000-4000-8000-000000000003','Open pool task','open','open','f1000000-0000-4000-8000-000000000003','normal');
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
  $$select public.update_own_staff_photo('https://example.invalid/avatar.webp','{"x":50,"y":50,"scale":1}'::jsonb)$$,
  'stylist can update validated self-service photo fields'
);
select lives_ok(
  $$select public.update_own_staff_photo('https://example.invalid/avatar.webp','{"x":0,"y":100,"scale":3}'::jsonb)$$,
  'photo crop accepts exact app boundaries'
);
select throws_ok(
  $$select public.update_own_staff_photo('https://example.invalid/avatar.webp','{"x":-1,"y":50,"scale":1}'::jsonb)$$,
  '22023', null, 'photo crop rejects x below zero'
);
select throws_ok(
  $$select public.update_own_staff_photo('https://example.invalid/avatar.webp','{"x":50,"y":101,"scale":1}'::jsonb)$$,
  '22023', null, 'photo crop rejects y above one hundred'
);
select throws_ok(
  $$select public.update_own_staff_photo('https://example.invalid/avatar.webp','{"x":50,"y":50,"scale":0.99}'::jsonb)$$,
  '22023', null, 'photo crop rejects scale below one'
);
select throws_ok(
  $$select public.update_own_staff_photo('https://example.invalid/avatar.webp','{"x":50,"y":50,"scale":3.01}'::jsonb)$$,
  '22023', null, 'photo crop rejects scale above three'
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
select throws_ok(
  $$insert into public.task_assignees(task_id,staff_id)
    values ('f2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'staff cannot bypass atomic claim RPC with direct assignee insert'
);
select lives_ok(
  $$select public.claim_task('f2000000-0000-4000-8000-000000000003')$$,
  'active staff can claim an open-pool task through the RPC'
);
select is(
  (select status from public.tasks where id='f2000000-0000-4000-8000-000000000003'),
  'claimed', 'claim RPC transitions open task to claimed'
);
select throws_ok(
  $$select public.claim_task('f2000000-0000-4000-8000-000000000003')$$,
  '22023', null, 'already-claimed task cannot be claimed again'
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

reset role;
select lives_ok(
  $$select public.admin_transition_staff_access(
    'f1000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000004',
    'invited','f0000000-0000-4000-8000-000000000004','invited','wave1-invite'
  )$$,
  'manager can atomically record a new invitation'
);
select is(
  (select access_status from public.staff where id='f1000000-0000-4000-8000-000000000004'),
  'invited', 'invitation transition persists invited state'
);
select lives_ok(
  $$select public.admin_transition_staff_access(
    'f1000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000004',
    'reinvited','f0000000-0000-4000-8000-000000000004','invited','wave1-resend'
  )$$,
  'resend preserves the same pending Auth identity'
);
select throws_ok(
  $$select public.admin_transition_staff_access(
    'f1000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000004',
    'reinvited','f0000000-0000-4000-8000-000000000005','invited','tamper'
  )$$,
  '22023', null, 'resend cannot replace the pending Auth identity'
);
select throws_ok(
  $$select public.admin_transition_staff_access(
    'f1000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000004',
    'linked','f0000000-0000-4000-8000-000000000005','active','tamper'
  )$$,
  '22023', null, 'activation cannot link a different Auth identity'
);
select lives_ok(
  $$select public.admin_transition_staff_access(
    'f1000000-0000-4000-8000-000000000003',
    'f1000000-0000-4000-8000-000000000004',
    'linked','f0000000-0000-4000-8000-000000000004','active','wave1-activate'
  )$$,
  'matching pending Auth identity can activate'
);
select is(
  (select count(*)::int from public.staff_security_audit
    where target_staff_id='f1000000-0000-4000-8000-000000000004'
      and action in ('invited', 'reinvited', 'linked')),
  3, 'invite, resend, and activation each create an audit row'
);
-- confirm_staff_invite is idempotent for an already-active linkage and never
-- reactivates a non-pending row (e.g. a recovery for an active/disabled user).
select is(
  public.confirm_staff_invite(
    'f0000000-0000-4000-8000-000000000004',
    'hardening-invite@example.invalid',
    'wave1-confirm-idempotent'
  ),
  'f1000000-0000-4000-8000-000000000004'::uuid,
  'confirm_staff_invite is idempotent once linked and active'
);
select is(
  public.confirm_staff_invite(
    'f0000000-0000-4000-8000-000000000005',
    'hardening-disabled@example.invalid',
    'wave1-confirm-disabled'
  ),
  null,
  'confirm_staff_invite never reactivates a disabled staff row'
);
select is(
  (select access_status from public.staff where id='f1000000-0000-4000-8000-000000000005'),
  'disabled', 'disabled staff remains disabled after a recovery-style confirm attempt'
);

select * from finish();
rollback;
