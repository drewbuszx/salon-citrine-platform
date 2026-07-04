-- Track 48h and 24h appointment reminder sends (Resend + Twilio cron job)

alter table public.appointments
  add column if not exists reminder_48h_sent_at timestamptz,
  add column if not exists reminder_24h_sent_at timestamptz;

comment on column public.appointments.reminder_48h_sent_at is
  'When the ~48h-before reminder email/SMS was sent (null = not yet sent)';
comment on column public.appointments.reminder_24h_sent_at is
  'When the ~24h-before reminder email/SMS was sent (null = not yet sent)';

create index if not exists appointments_reminder_48h_pending_idx
  on public.appointments (starts_at)
  where reminder_48h_sent_at is null
    and status in ('confirmed', 'pending');

create index if not exists appointments_reminder_24h_pending_idx
  on public.appointments (starts_at)
  where reminder_24h_sent_at is null
    and status in ('confirmed', 'pending');
