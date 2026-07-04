-- Fix infinite recursion in task_assignees RLS (self-referential EXISTS subquery).
-- Use a security definer helper so policies can check assignment without re-entering RLS.

create or replace function public.is_assigned_to_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_assignees
    where task_id = p_task_id
      and staff_id = public.current_staff_id()
  );
$$;

revoke all on function public.is_assigned_to_task(uuid) from public;
grant execute on function public.is_assigned_to_task(uuid) to authenticated;

drop policy if exists "Team read tasks" on public.tasks;
create policy "Team read tasks"
  on public.tasks for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or (
        assignment_type = 'open'
        and status in ('open', 'claimed', 'done')
      )
      or public.is_assigned_to_task(id)
    )
  );

drop policy if exists "Staff complete assigned tasks" on public.tasks;
create policy "Staff complete assigned tasks"
  on public.tasks for update
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and status in ('open', 'claimed')
    and public.is_assigned_to_task(id)
  )
  with check (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and status = 'done'
  );

drop policy if exists "Team read task assignees" on public.task_assignees;
create policy "Team read task assignees"
  on public.task_assignees for select
  using (
    auth.role() = 'authenticated'
    and public.is_linked_staff()
    and (
      public.is_salon_manager()
      or staff_id = public.current_staff_id()
      or exists (
        select 1
        from public.tasks t
        where t.id = task_assignees.task_id
          and t.assignment_type = 'open'
          and t.status in ('open', 'claimed', 'done')
      )
      or public.is_assigned_to_task(task_id)
    )
  );
