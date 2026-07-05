-- Track captured deposits and cancellation fees on appointments.

alter table public.appointments
  add column if not exists deposit_charged_cents integer not null default 0
    check (deposit_charged_cents >= 0),
  add column if not exists cancel_fee_cents integer not null default 0
    check (cancel_fee_cents >= 0),
  add column if not exists cancel_fee_stripe_payment_intent_id text;
