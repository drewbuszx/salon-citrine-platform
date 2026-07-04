-- Per-stylist flag: when false, client booking shows a gate for new vs existing clients.

alter table public.staff
  add column if not exists accepting_new_clients boolean not null default true;
