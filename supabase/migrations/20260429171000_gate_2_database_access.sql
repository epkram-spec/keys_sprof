-- Gate 2: database schema, seed data, and RLS policies.
-- Do not apply to staging/production without explicit owner approval.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('manager', 'marketing', 'leader', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_in_app_status as enum ('unread', 'read');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_delivery_status as enum ('pending', 'sent', 'failed', 'skipped');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.google_sheet_import_status as enum ('pending', 'running', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'manager',
  display_name text,
  is_active boolean not null default true,
  telegram_chat_id text,
  telegram_username text,
  notification_email_enabled boolean not null default true,
  notification_telegram_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  assigned_marketing_user_id uuid references public.profiles(id) on delete set null,
  segment_id uuid references public.case_segments(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  project_status text,
  marketing_status text,
  score integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint cases_score_range check (score is null or (score >= 0 and score <= 100))
);

create table if not exists public.case_comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  uploaded_by_user_id uuid references public.profiles(id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint case_files_size_nonnegative check (size_bytes is null or size_bytes >= 0)
);

create table if not exists public.case_activity_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.google_sheet_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spreadsheet_id text not null,
  sheet_name text,
  is_active boolean not null default true,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spreadsheet_id, sheet_name)
);

create table if not exists public.google_sheet_imports (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.google_sheet_sources(id) on delete cascade,
  started_by_user_id uuid references public.profiles(id) on delete set null,
  status public.google_sheet_import_status not null default 'pending',
  rows_total integer not null default 0,
  rows_created integer not null default 0,
  rows_updated integer not null default 0,
  rows_failed integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint google_sheet_imports_rows_nonnegative check (
    rows_total >= 0 and rows_created >= 0 and rows_updated >= 0 and rows_failed >= 0
  )
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (dedupe_key)
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_role_snapshot public.app_role not null,
  in_app_status public.notification_in_app_status not null default 'unread',
  read_at timestamptz,
  email_status public.notification_delivery_status not null default 'pending',
  email_sent_at timestamptz,
  telegram_status public.notification_delivery_status not null default 'pending',
  telegram_sent_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now(),
  unique (event_id, recipient_user_id),
  constraint notification_recipients_read_at_check check (
    (in_app_status = 'read' and read_at is not null)
    or (in_app_status = 'unread' and read_at is null)
  )
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_email_idx on public.profiles(lower(email));
create index if not exists cases_owner_user_id_idx on public.cases(owner_user_id);
create index if not exists cases_assigned_marketing_user_id_idx on public.cases(assigned_marketing_user_id);
create index if not exists cases_segment_id_idx on public.cases(segment_id);
create index if not exists cases_city_id_idx on public.cases(city_id);
create index if not exists case_comments_case_id_idx on public.case_comments(case_id);
create index if not exists case_files_case_id_idx on public.case_files(case_id);
create index if not exists case_activity_log_case_id_idx on public.case_activity_log(case_id);
create index if not exists google_sheet_imports_source_id_idx on public.google_sheet_imports(source_id);
create index if not exists notification_events_case_id_idx on public.notification_events(case_id);
create index if not exists notification_events_dedupe_key_idx on public.notification_events(dedupe_key);
create index if not exists notification_recipients_user_status_idx
  on public.notification_recipients(recipient_user_id, in_app_status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

drop trigger if exists case_comments_set_updated_at on public.case_comments;
create trigger case_comments_set_updated_at
before update on public.case_comments
for each row execute function public.set_updated_at();

drop trigger if exists google_sheet_sources_set_updated_at on public.google_sheet_sources;
create trigger google_sheet_sources_set_updated_at
before update on public.google_sheet_sources
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.can_view_all_cases()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin', 'leader', 'marketing'), false);
$$;

create or replace function public.can_view_case(
  case_owner_user_id uuid,
  case_assigned_marketing_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.can_view_all_cases()
    or case_owner_user_id = auth.uid()
    or case_assigned_marketing_user_id = auth.uid(),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, display_name)
  values (
    new.id,
    lower(new.email),
    case when lower(new.email) = 'epkram@gmail.com' then 'admin'::public.app_role else 'manager'::public.app_role end,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = case when excluded.email = 'epkram@gmail.com' then 'admin'::public.app_role else public.profiles.role end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, role, display_name, is_active)
select id, lower(email), 'admin'::public.app_role, coalesce(raw_user_meta_data ->> 'display_name', 'Адміністратор'), true
from auth.users
where lower(email) = 'epkram@gmail.com'
on conflict (id) do update
set role = 'admin'::public.app_role,
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    is_active = true,
    updated_at = now();

insert into public.case_segments (name, sort_order) values
  ('Виробництво', 10),
  ('Послуги', 20),
  ('Освіта', 30),
  ('Медицина', 40),
  ('Ритейл', 50),
  ('HoReCa', 60),
  ('Будівництво', 70),
  ('Логістика', 80),
  ('IT та цифрові продукти', 90),
  ('Громадський сектор', 100),
  ('Інше', 999)
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true;

insert into public.cities (name, sort_order) values
  ('Київ', 10),
  ('Львів', 20),
  ('Одеса', 30),
  ('Дніпро', 40),
  ('Харків', 50),
  ('Запоріжжя', 60),
  ('Вінниця', 70),
  ('Івано-Франківськ', 80),
  ('Тернопіль', 90),
  ('Луцьк', 100),
  ('Рівне', 110),
  ('Хмельницький', 120),
  ('Чернівці', 130),
  ('Ужгород', 140),
  ('Житомир', 150),
  ('Полтава', 160),
  ('Черкаси', 170),
  ('Кропивницький', 180),
  ('Миколаїв', 190),
  ('Херсон', 200),
  ('Чернігів', 210),
  ('Суми', 220),
  ('Інше', 999)
on conflict (name) do update
set sort_order = excluded.sort_order,
    is_active = true;

alter table public.profiles enable row level security;
alter table public.case_segments enable row level security;
alter table public.cities enable row level security;
alter table public.cases enable row level security;
alter table public.case_comments enable row level security;
alter table public.case_files enable row level security;
alter table public.case_activity_log enable row level security;
alter table public.google_sheet_sources enable row level security;
alter table public.google_sheet_imports enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_recipients enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert
to authenticated
with check (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
on public.profiles for delete
to authenticated
using (public.is_admin());

drop policy if exists "case_segments_select_active" on public.case_segments;
create policy "case_segments_select_active"
on public.case_segments for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "case_segments_admin_write" on public.case_segments;
create policy "case_segments_admin_write"
on public.case_segments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "cities_select_active" on public.cities;
create policy "cities_select_active"
on public.cities for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists "cities_admin_write" on public.cities;
create policy "cities_admin_write"
on public.cities for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "cases_select_by_access" on public.cases;
create policy "cases_select_by_access"
on public.cases for select
to authenticated
using (public.can_view_case(owner_user_id, assigned_marketing_user_id));

drop policy if exists "cases_insert_own_or_admin" on public.cases;
create policy "cases_insert_own_or_admin"
on public.cases for insert
to authenticated
with check (
  public.is_admin()
  or (owner_user_id = auth.uid() and created_by_user_id = auth.uid())
);

drop policy if exists "cases_update_by_access" on public.cases;
create policy "cases_update_by_access"
on public.cases for update
to authenticated
using (public.can_view_case(owner_user_id, assigned_marketing_user_id))
with check (public.can_view_case(owner_user_id, assigned_marketing_user_id));

drop policy if exists "cases_delete_admin" on public.cases;
create policy "cases_delete_admin"
on public.cases for delete
to authenticated
using (public.is_admin());

drop policy if exists "case_comments_select_by_case_access" on public.case_comments;
create policy "case_comments_select_by_case_access"
on public.case_comments for select
to authenticated
using (exists (
  select 1 from public.cases c
  where c.id = case_comments.case_id
    and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
));

drop policy if exists "case_comments_insert_by_case_access" on public.case_comments;
create policy "case_comments_insert_by_case_access"
on public.case_comments for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and exists (
    select 1 from public.cases c
    where c.id = case_comments.case_id
      and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
  )
);

drop policy if exists "case_comments_update_author_or_admin" on public.case_comments;
create policy "case_comments_update_author_or_admin"
on public.case_comments for update
to authenticated
using (author_user_id = auth.uid() or public.is_admin())
with check (author_user_id = auth.uid() or public.is_admin());

drop policy if exists "case_comments_delete_author_or_admin" on public.case_comments;
create policy "case_comments_delete_author_or_admin"
on public.case_comments for delete
to authenticated
using (author_user_id = auth.uid() or public.is_admin());

drop policy if exists "case_files_select_by_case_access" on public.case_files;
create policy "case_files_select_by_case_access"
on public.case_files for select
to authenticated
using (exists (
  select 1 from public.cases c
  where c.id = case_files.case_id
    and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
));

drop policy if exists "case_files_insert_by_case_access" on public.case_files;
create policy "case_files_insert_by_case_access"
on public.case_files for insert
to authenticated
with check (
  uploaded_by_user_id = auth.uid()
  and exists (
    select 1 from public.cases c
    where c.id = case_files.case_id
      and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
  )
);

drop policy if exists "case_files_delete_uploader_or_admin" on public.case_files;
create policy "case_files_delete_uploader_or_admin"
on public.case_files for delete
to authenticated
using (uploaded_by_user_id = auth.uid() or public.is_admin());

drop policy if exists "case_activity_log_select_by_case_access" on public.case_activity_log;
create policy "case_activity_log_select_by_case_access"
on public.case_activity_log for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.cases c
    where c.id = case_activity_log.case_id
      and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
  )
);

drop policy if exists "case_activity_log_insert_authenticated" on public.case_activity_log;
create policy "case_activity_log_insert_authenticated"
on public.case_activity_log for insert
to authenticated
with check (actor_user_id = auth.uid() or public.is_admin());

drop policy if exists "google_sheet_sources_admin_all" on public.google_sheet_sources;
create policy "google_sheet_sources_admin_all"
on public.google_sheet_sources for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "google_sheet_imports_admin_all" on public.google_sheet_imports;
create policy "google_sheet_imports_admin_all"
on public.google_sheet_imports for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notification_events_select_by_recipient_or_admin" on public.notification_events;
create policy "notification_events_select_by_recipient_or_admin"
on public.notification_events for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.notification_recipients nr
    where nr.event_id = notification_events.id
      and nr.recipient_user_id = auth.uid()
  )
);

drop policy if exists "notification_events_admin_insert" on public.notification_events;
create policy "notification_events_admin_insert"
on public.notification_events for insert
to authenticated
with check (public.is_admin());

drop policy if exists "notification_events_admin_update" on public.notification_events;
create policy "notification_events_admin_update"
on public.notification_events for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notification_events_admin_delete" on public.notification_events;
create policy "notification_events_admin_delete"
on public.notification_events for delete
to authenticated
using (public.is_admin());

drop policy if exists "notification_recipients_select_own_or_admin" on public.notification_recipients;
create policy "notification_recipients_select_own_or_admin"
on public.notification_recipients for select
to authenticated
using (recipient_user_id = auth.uid() or public.is_admin());

drop policy if exists "notification_recipients_update_admin" on public.notification_recipients;
create policy "notification_recipients_update_admin"
on public.notification_recipients for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "notification_recipients_admin_insert" on public.notification_recipients;
create policy "notification_recipients_admin_insert"
on public.notification_recipients for insert
to authenticated
with check (public.is_admin());

drop policy if exists "notification_recipients_admin_delete" on public.notification_recipients;
create policy "notification_recipients_admin_delete"
on public.notification_recipients for delete
to authenticated
using (public.is_admin());
