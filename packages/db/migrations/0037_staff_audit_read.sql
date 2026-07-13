-- Wave 8 / task 39: expose the existing staff_security_audit log to managers.
--
-- 0030 created the table and a manager-only RLS SELECT policy but never granted
-- the table privilege, so the policy was unreachable through the API. This adds
-- the missing column-safe SELECT grant; RLS still restricts rows to managers.
grant select on public.staff_security_audit to authenticated;