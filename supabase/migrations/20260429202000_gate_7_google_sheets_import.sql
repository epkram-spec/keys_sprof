-- Gate 7: controlled Google Sheets import metadata.
-- Do not apply to staging/production without approval.

alter table public.google_sheet_sources
  add column if not exists mapping jsonb not null default '{}'::jsonb;

create index if not exists cases_google_sheet_row_id_idx
  on public.cases ((metadata ->> 'googleSheetRowId'));

create index if not exists cases_client_name_idx
  on public.cases ((lower(metadata ->> 'clientName')));

create index if not exists google_sheet_sources_mapping_idx
  on public.google_sheet_sources using gin (mapping);
