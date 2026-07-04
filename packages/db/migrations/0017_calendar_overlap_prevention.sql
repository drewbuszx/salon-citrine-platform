-- Prevent double booking and overlapping blocks at the database layer.
-- Active appointments (pending, confirmed) cannot overlap per staff member.
-- Blocked times cannot overlap per staff member.
-- Active appointments cannot overlap blocked times.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- appointments: no overlapping active bookings for the same staff member
-- ---------------------------------------------------------------------------
alter table public.appointments
  add constraint appointments_no_staff_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));

-- ---------------------------------------------------------------------------
-- blocked_times: no overlapping blocks for the same staff member
-- ---------------------------------------------------------------------------
alter table public.blocked_times
  add constraint blocked_times_no_staff_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  );

-- ---------------------------------------------------------------------------
-- appointments: active bookings must not overlap blocked times
-- ---------------------------------------------------------------------------
create or replace function public.enforce_appointment_not_blocked()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  if exists (
    select 1
    from public.blocked_times bt
    where bt.staff_id = new.staff_id
      and tstzrange(bt.starts_at, bt.ends_at, '[)')
          && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'appointment conflicts with blocked time'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger appointments_enforce_not_blocked
  before insert or update of staff_id, starts_at, ends_at, status
  on public.appointments
  for each row
  execute function public.enforce_appointment_not_blocked();
