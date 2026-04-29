-- Gate 8: private Supabase Storage bucket for case files.
-- Do not apply to staging/production without approval.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-files',
  'case-files',
  false,
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "case_files_storage_select_by_case_access" on storage.objects;
create policy "case_files_storage_select_by_case_access"
on storage.objects for select
to authenticated
using (
  bucket_id = 'case-files'
  and exists (
    select 1
    from public.case_files cf
    join public.cases c on c.id = cf.case_id
    where cf.storage_bucket = storage.objects.bucket_id
      and cf.storage_path = storage.objects.name
      and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
  )
);

drop policy if exists "case_files_storage_insert_by_case_access" on storage.objects;
create policy "case_files_storage_insert_by_case_access"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'case-files'
  and exists (
    select 1
    from public.cases c
    where c.id = nullif(split_part(storage.objects.name, '/', 1), '')::uuid
      and public.can_view_case(c.owner_user_id, c.assigned_marketing_user_id)
  )
);

drop policy if exists "case_files_storage_delete_uploader_or_admin" on storage.objects;
create policy "case_files_storage_delete_uploader_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'case-files'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.case_files cf
      where cf.storage_bucket = storage.objects.bucket_id
        and cf.storage_path = storage.objects.name
        and cf.uploaded_by_user_id = auth.uid()
    )
  )
);
