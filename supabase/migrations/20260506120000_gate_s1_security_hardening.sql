-- Gate S1: defense-in-depth for direct Supabase API case updates.
-- Do not apply to staging/production without approval.

create or replace function public.enforce_case_update_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.app_role;
begin
  actor_role := public.current_user_role();

  if actor_role is null then
    raise exception 'case update requires an active profile';
  end if;

  if actor_role = 'admin' then
    return new;
  end if;

  if new.owner_user_id is distinct from old.owner_user_id
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.assigned_marketing_user_id is distinct from old.assigned_marketing_user_id
    or new.archived_at is distinct from old.archived_at then
    raise exception 'case ownership, assignment and archive fields are admin-only';
  end if;

  if new.marketing_status is distinct from old.marketing_status
    and actor_role not in ('marketing', 'leader')
    and new.marketing_status <> 'Перевірити' then
    raise exception 'marketing status update is not allowed for this role';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_case_update_security_trigger on public.cases;
create trigger enforce_case_update_security_trigger
before update on public.cases
for each row execute function public.enforce_case_update_security();
