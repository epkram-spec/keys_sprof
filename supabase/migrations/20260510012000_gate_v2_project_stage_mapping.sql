-- Gate v2: consolidate old project stages into the 6 approved manager-facing stages.
-- This keeps existing case metadata readable after the UI stage list was simplified.

alter table public.cases disable trigger enforce_case_update_security_trigger;

with stage_map(old_stage, new_stage) as (
  values
    ('Оплата за обладнання', 'Оплата і підготовка'),
    ('Комплектація погоджена', 'Оплата і підготовка'),
    ('Проєктування / підбір рішення', 'Проєктування'),
    ('Доставка запланована', 'Доставка'),
    ('Доставка виконана', 'Доставка'),
    ('Монтаж запланований', 'Монтаж'),
    ('Монтаж у процесі', 'Монтаж'),
    ('Монтаж виконано', 'Монтаж'),
    ('Запуск / навчання заплановано', 'Запуск і робота'),
    ('Запуск / навчання виконано', 'Запуск і робота'),
    ('Робоче навантаження / експлуатація', 'Запуск і робота'),
    ('Готово для маркетингу', 'Маркетинг і архів'),
    ('Опубліковано', 'Маркетинг і архів'),
    ('Архів', 'Маркетинг і архів')
)
update public.cases c
set metadata = jsonb_set(
  c.metadata,
  '{marketingMonitoring,projectStage}',
  to_jsonb(stage_map.new_stage),
  true
)
from stage_map
where c.metadata #>> '{marketingMonitoring,projectStage}' = stage_map.old_stage;

alter table public.cases enable trigger enforce_case_update_security_trigger;
