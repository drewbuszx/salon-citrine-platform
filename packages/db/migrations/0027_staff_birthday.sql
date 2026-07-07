-- Staff birthdays for team events calendar markers
alter table public.staff
  add column if not exists birthday date;

comment on column public.staff.birthday is 'Optional date of birth for team calendar birthday markers';
