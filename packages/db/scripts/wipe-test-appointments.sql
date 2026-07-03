-- Dev helper: remove test bookings so availability shows full schedules.
-- Run via Supabase SQL editor or: psql $DATABASE_URL -f packages/db/scripts/wipe-test-appointments.sql

delete from public.appointment_services;
delete from public.appointments;
