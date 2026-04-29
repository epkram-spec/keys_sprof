-- Gate 9: allow users to mark only their own in-app notifications as read.
-- Do not apply to staging/production without approval.

drop policy if exists "notification_recipients_update_own_read_status" on public.notification_recipients;

create or replace function public.mark_own_notification_read(recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_recipients
  set in_app_status = 'read',
      read_at = now()
  where id = recipient_id
    and recipient_user_id = auth.uid();
end;
$$;

create or replace function public.mark_all_own_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_recipients
  set in_app_status = 'read',
      read_at = now()
  where recipient_user_id = auth.uid()
    and in_app_status = 'unread';
end;
$$;

grant execute on function public.mark_own_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_own_notifications_read() to authenticated;
