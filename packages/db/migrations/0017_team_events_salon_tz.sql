-- Reinterpret seed team_events stored as UTC wall-clock as salon local time.
-- Only touches the four fixed seed UUIDs from 0015_team_events.sql.

update public.team_events
set
  starts_at = (starts_at at time zone 'utc') at time zone 'America/Indiana/Indianapolis',
  ends_at = case
    when ends_at is null then null
    else (ends_at at time zone 'utc') at time zone 'America/Indiana/Indianapolis'
  end
where id in (
  'e1000001-0001-4000-8000-000000000001',
  'e1000001-0001-4000-8000-000000000002',
  'e1000001-0001-4000-8000-000000000003',
  'e1000001-0001-4000-8000-000000000004'
);
