-- Explicit Data API grants for roles that RLS already constrains.
-- Required when Supabase auto_expose_new_tables is off (CLI/cloud default flip).
-- Idempotent: safe to re-run; does not widen privileges beyond historical auto-expose.

grant usage on schema public to anon, authenticated, service_role;

-- Core booking / team tables (RLS policies remain the authorization layer).
grant select on public.staff to authenticated, service_role;
grant select on public.services to anon, authenticated, service_role;
grant select on public.staff_services to anon, authenticated, service_role;
grant select on public.staff_schedules to anon, authenticated, service_role;
grant select on public.blocked_times to authenticated, service_role;
grant select on public.clients to authenticated, service_role;
grant select on public.appointments to authenticated, service_role;
grant select on public.appointment_services to authenticated, service_role;
grant select on public.email_logs to authenticated, service_role;
grant select on public.sms_logs to authenticated, service_role;
grant select on public.policies to anon, authenticated, service_role;

grant select, insert, update, delete on public.tasks to authenticated, service_role;
grant select, insert, update, delete on public.task_assignees to authenticated, service_role;
grant select, insert, update, delete on public.team_documents to authenticated, service_role;
-- team_events: keep column-level SELECT from 0030/0036 (private_reason / manager_notes stay gated).
grant select (
  id, title, description, event_type, starts_at, ends_at, all_day, created_by_staff_id,
  staff_id, is_active, created_at, updated_at, visibility, approval_status,
  decided_by_staff_id, decided_at
) on public.team_events to authenticated;
grant insert, update on public.team_events to authenticated, service_role;
grant select on public.team_events to service_role;
grant select, insert, update, delete on public.products to authenticated, service_role;
grant select, insert, update, delete on public.inventory_stock to authenticated, service_role;
grant select, insert, update, delete on public.inventory_transactions to authenticated, service_role;
grant select, insert, update, delete on public.salon_routines to authenticated, service_role;
grant select, insert, update, delete on public.salon_routine_items to authenticated, service_role;
grant select, insert, update, delete on public.salon_routine_completions to authenticated, service_role;

-- Projections / helpers created by hardening waves (re-affirm).
grant select on public.public_staff_profiles to anon, authenticated, service_role;
grant select on public.public_blocked_intervals to anon, authenticated, service_role;
grant select on public.appointment_availability to anon, authenticated, service_role;

-- service_role retains full access for Worker / admin paths.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
