-- Gate 10: notification delivery metadata and Telegram start-token flow.
-- Do not apply to staging/production without approval.

create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_user_id_idx on public.telegram_link_tokens(user_id);
create index if not exists telegram_link_tokens_token_idx on public.telegram_link_tokens(token);

alter table public.telegram_link_tokens enable row level security;

drop policy if exists "telegram_link_tokens_select_own_or_admin" on public.telegram_link_tokens;
create policy "telegram_link_tokens_select_own_or_admin"
on public.telegram_link_tokens for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "telegram_link_tokens_insert_own" on public.telegram_link_tokens;
create policy "telegram_link_tokens_insert_own"
on public.telegram_link_tokens for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "telegram_link_tokens_update_own_or_admin" on public.telegram_link_tokens;
create policy "telegram_link_tokens_update_own_or_admin"
on public.telegram_link_tokens for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "notification_recipients_update_delivery_status" on public.notification_recipients;
create policy "notification_recipients_update_delivery_status"
on public.notification_recipients for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.update_own_notification_settings(
  email_enabled boolean,
  telegram_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set notification_email_enabled = email_enabled,
      notification_telegram_enabled = case
        when telegram_chat_id is null then false
        else telegram_enabled
      end,
      updated_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.update_own_notification_settings(boolean, boolean) to authenticated;
