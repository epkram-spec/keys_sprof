-- Gate v2: rename marketing statuses to the owner-approved wording.
-- Existing case rows keep their meaning, but labels become clearer for marketing workflow.

alter table public.cases disable trigger enforce_case_update_security_trigger;

with status_map(old_status, new_status) as (
  values
    ('Потрібно погодити зйомку', 'Погодити зйомку'),
    ('Зйомка запланована', 'Зйомку заплановано'),
    ('Монтаж', 'Матеріали в обробці')
)
update public.cases c
set marketing_status = status_map.new_status,
    metadata = jsonb_set(
      c.metadata,
      '{marketingWorkflow,statusMigratedAt}',
      to_jsonb(now()),
      true
    )
from status_map
where c.marketing_status = status_map.old_status;

alter table public.cases enable trigger enforce_case_update_security_trigger;
