-- Gate 5: allow authenticated users to create hot-case notification events
-- for cases they are allowed to see. Do not apply to staging/production without approval.

drop policy if exists "notification_events_insert_case_hot_by_case_access" on public.notification_events;
create policy "notification_events_insert_case_hot_by_case_access"
on public.notification_events for insert
to authenticated
with check (
  type = 'case_hot'
  and actor_user_id = auth.uid()
  and case_id is not null
  and exists (
    select 1
    from public.cases c
    where c.id = notification_events.case_id
      and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
  )
);
