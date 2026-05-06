# Security audit: Радар кейсів SPROF

Дата: 2026-05-06  
Сфера: Next.js App Router, Server Actions, Route Handlers, Supabase Auth/PostgreSQL/RLS/Storage, Google Sheets, email/Telegram notifications.

## Короткий висновок

Проєкт має нормальну базову архітектуру для внутрішнього сервісу: приватні сторінки, Supabase Auth, RLS, приватний Storage bucket, server-side завантаження файлів. Але є кілька серйозних прогалин: у репозиторії присутні реальні-looking секрети, cron/webhook endpoints можуть стати відкритими при порожніх env, частина RLS політик занадто широка для прямого Supabase API, а server actions іноді обходять власні RLS-обмеження через service role.

Найперше потрібно ротувати Supabase ключі та cron secret, прибрати секрети з `.env.example`, зробити секретні endpoint-и fail-closed, потім звузити RLS і винести небезпечні зміни в перевірені RPC/server actions.

## Critical

### SEC-001: Supabase service role key і CRON_SECRET закомічені в `.env.example`

Severity: Critical

Location: `.env.example:3-5`, `.env.example:25`, `.gitignore:1-3`

Evidence:

```text
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<real-looking JWT>"
SUPABASE_SERVICE_ROLE_KEY="<real-looking service_role JWT>"
CRON_SECRET="..."
```

Impact: `service_role` обходить RLS у Supabase. Якщо цей ключ був у GitHub, логах, архівах або у когось локально, атакер може читати й змінювати всі дані, включно з профілями, кейсами, файлами, сповіщеннями та Telegram прив'язками. `CRON_SECRET` дозволяє запускати службові endpoint-и.

Fix:

1. Негайно ротувати Supabase JWT secret / service role key у Supabase.
2. Ротувати anon key, якщо він змінюється разом із JWT secret.
3. Ротувати `CRON_SECRET`, Telegram webhook secret та інші секрети, які могли бути скопійовані з `.env.example`.
4. Замінити значення в `.env.example` на плейсхолдери: `your-project-url`, `your-anon-key`, `your-service-role-key`, `generate-a-long-random-secret`.
5. Перевірити історію Git і GitHub secret scanning. Якщо ключ уже був у віддаленому репозиторії, вважати його скомпрометованим навіть після видалення з файлу.

Mitigation: додати pre-commit/CI secret scanning (`gitleaks` або GitHub secret scanning), заборонити реальні JWT у `.env.example`.

### SEC-002: Cron endpoints fail-open, якщо `CRON_SECRET` порожній

Severity: Critical/High залежно від production env

Location: `src/app/api/notifications/deliver/route.ts:6-15`, `src/app/api/cases/stage-reminders/route.ts:17-25`, `src/env.ts:23`

Evidence:

```ts
if (env.CRON_SECRET && token !== env.CRON_SECRET) {
  return NextResponse.json(..., { status: 401 });
}
```

Impact: якщо `CRON_SECRET` не заданий або випадково порожній, будь-хто в інтернеті може запускати delivery нотифікацій або stage reminders. Обидва endpoint-и використовують server-side привілеї; `stage-reminders` читає всі неархівовані кейси через service role і створює записи, `deliver` може спричиняти email/Telegram розсилку та спам.

Fix:

1. Зробити fail-closed: якщо `CRON_SECRET` відсутній у production, повертати 503/500 і не виконувати дію.
2. Приймати тільки `Authorization: Bearer <secret>`, без альтернативних слабших каналів.
3. Перевести `stage-reminders` з GET на POST, бо зараз GET змінює стан.
4. Додати rate limit / Vercel cron allowlist / edge middleware для цих endpoint-ів.

Mitigation: окремий довгий random secret мінімум 32 байти, ротація після кожного витоку, логування невдалих спроб без виводу токена.

## High

### SEC-003: Telegram webhook fail-open, якщо webhook secret порожній

Severity: High

Location: `src/app/api/telegram/webhook/route.ts:19-26`, `src/app/api/telegram/webhook/route.ts:34-58`, `src/env.ts:21`

Evidence:

```ts
if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
  return NextResponse.json({ ok: false }, { status: 401 });
}
const update = (await request.json()) as TelegramUpdate;
const supabase = createSupabaseAdminClient();
```

Impact: якщо secret не заданий, endpoint приймає будь-який POST. Атакер не зможе прив'язати Telegram без чинного start-token, але зможе необмежено бити endpoint, змушувати парсити JSON і виконувати service-role lookup по токенах. Це DoS/abuse поверхня, а при витоку start-token дозволить підв'язати чужий chat_id.

Fix:

1. Fail-closed для production, якщо `TELEGRAM_WEBHOOK_SECRET` порожній.
2. Додати обмеження розміру body та runtime validation через Zod.
3. Додати rate limit.
4. Зберігати start-token хешованим, а не plaintext, і порівнювати hash.

### SEC-004: RLS для `cases` дозволяє надто широкі прямі update через Supabase API

Severity: High

Location: `supabase/migrations/20260429171000_gate_2_database_access.sql:423-443`

Evidence:

```sql
create policy "cases_update_by_access"
on public.cases for update
to authenticated
using (public.can_view_case(owner_user_id, assigned_marketing_user_id))
with check (public.can_view_case(owner_user_id, assigned_marketing_user_id));
```

Impact: RLS бачить лише "може переглядати кейс", але не обмежує, які поля можна міняти. Будь-який authenticated user із доступом до кейсу може напряму через Supabase REST/JS client оновлювати `marketing_status`, `score`, `metadata`, `owner_user_id`, `assigned_marketing_user_id`, `archived_at` тощо, якщо grants це дозволяють. Для ролей `marketing`, `leader`, `admin` `can_view_all_cases()` дає доступ до всіх кейсів, отже policy стає дуже широкою.

Fix:

1. Заборонити прямі широкі updates до `cases` з authenticated role.
2. Винести зміни кейсів у SECURITY DEFINER RPC або server-only service functions із явною role/action матрицею.
3. Якщо потрібен прямий RLS update, розділити політики за ролями та діями: менеджер редагує тільки власні поля власного кейсу; маркетинг змінює тільки маркетингові поля; керівник read-mostly або чітко визначені поля; архівація тільки адміністратор.
4. Розглянути column-level privileges або `revoke update on public.cases from authenticated` + вузькі RPC.

### SEC-005: Server action обходить RLS і дозволяє неадміну створювати міста

Severity: High/Medium

Location: `src/app/(private)/cases/actions.ts:20-45`, `src/app/(private)/cases/actions.ts:197-203`, `supabase/migrations/20260429171000_gate_2_database_access.sql:416-421`

Evidence:

```ts
const adminSupabase = createSupabaseAdminClient();
await adminSupabase.from("cities").insert({ name: cityName, sort_order: 998, is_active: true })
```

RLS для `cities` дозволяє write тільки admin:

```sql
using (public.is_admin())
with check (public.is_admin());
```

Impact: будь-який користувач, який може створювати/оновлювати кейс, може створити довільне місто через server action, хоча RLS і admin UI кажуть, що довідником керує тільки адміністратор. Це data poisoning і privilege bypass.

Fix:

1. При створенні/редагуванні кейсу дозволяти тільки існуючий `city_id`.
2. Нові міста створювати окремим admin action або moderation flow.
3. Прибрати service-role insert із `resolveCityId`.

### SEC-006: Немає видимих security headers / CSP у Next config

Severity: High/Medium

Location: `next.config.ts:1-7`

Evidence:

```ts
const nextConfig: NextConfig = {
  reactStrictMode: true,
};
```

Impact: у repo не видно CSP, `X-Content-Type-Options`, `Frame-Ancestors`/`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. React екранує JSX, але сервіс зберігає користувацький контент, файли, CSV та повідомлення; CSP потрібна як defense-in-depth від XSS і clickjacking.

Fix:

1. Додати централізовані headers у `next.config.ts` або Vercel edge config.
2. Мінімум: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` або CSP `frame-ancestors 'none'`, обмежений `Permissions-Policy`.
3. Почати CSP у Report-Only на staging, потім enforce.

## Medium

### SEC-007: CSV export вразливий до spreadsheet formula injection

Severity: Medium

Location: `src/lib/reports/csv.ts:17-35`, `src/app/(private)/reports/export.csv/route.ts:41-49`

Evidence:

```ts
const escaped = value.replaceAll('"', '""');
return `"${escaped}"`;
```

Impact: якщо назва кейсу, менеджер, місто або інші поля починаються з `=`, `+`, `-`, `@`, Excel/Google Sheets можуть виконати це як формулу після відкриття CSV. Це може призвести до data exfiltration або шкідливих external links у spreadsheet.

Fix:

1. Перед CSV escaping нейтралізувати формульні значення: якщо trimmed cell починається з `=`, `+`, `-`, `@`, tab або CR/LF, prefix `'`.
2. Додати unit tests для `buildCasesCsv`.

### SEC-008: Upload validation спирається на browser-provided MIME і розширення

Severity: Medium

Location: `src/lib/cases/files.ts:30-35`, `src/app/(private)/cases/actions.ts:345-383`, `supabase/migrations/20260429205000_gate_8_case_files_storage.sql:4-22`

Evidence:

```ts
allowedCaseFileTypes.includes(file.type) &&
allowedCaseFileExtensions.some((extension) => lowerName.endsWith(extension))
```

Impact: `file.type` і filename контролюються клієнтом. Bucket приватний і download route віддає `Content-Disposition: attachment`, це знижує XSS-ризик, але у сховищі все одно можуть лежати підроблені або небезпечні файли під дозволеним MIME/extension. Також ліміт 100 MB може бути дорогим без rate limit.

Fix:

1. Додати server-side magic number sniffing для jpg/png/webp/pdf/mp4/mov.
2. Додати per-user/per-case upload quotas і rate limit.
3. За потреби додати malware scanning перед доступністю файлу.

### SEC-009: Login не має app-level throttling

Severity: Medium

Location: `src/app/(auth)/login/actions.ts:12-36`

Evidence:

```ts
await supabase.auth.signInWithPassword({ email, password });
```

Impact: якщо покладатися тільки на Supabase defaults, app-level захист від brute force, credential stuffing і password spraying не видно в коді. Для внутрішнього сервісу це варто закрити на edge/app рівні.

Fix:

1. Перевірити Supabase Auth rate limits/MFA/password policy.
2. Додати Vercel/edge rate limit за IP + email hash для login action.
3. Додати alerting на багато невдалих входів.

### SEC-010: State-changing reminder endpoint використовує GET

Severity: Medium

Location: `src/app/api/cases/stage-reminders/route.ts:17-88`

Evidence:

```ts
export async function GET(request: Request) {
  ...
  await supabase.from("notification_events").upsert(...)
}
```

Impact: GET має бути safe/idempotent для читання. Тут він створює сповіщення і recipients. Це погано для кешів, prefetch, ботів, логів і випадкового запуску.

Fix: замінити на POST, додати `Cache-Control: no-store`, вимагати bearer token fail-closed.

### SEC-011: Plaintext Telegram link tokens доступні власнику через RLS

Severity: Medium/Low

Location: `supabase/migrations/20260429215000_gate_10_notification_delivery.sql:4-35`, `src/lib/telegram/linking.ts:1-3`

Evidence:

```sql
token text not null unique
using (user_id = auth.uid() or public.is_admin())
```

Impact: токен короткоживучий і random, але зберігається plaintext. Якщо акаунт користувача скомпрометовано або токен витік через logs/UI, можна прив'язати chat_id до профілю до expiry.

Fix:

1. Зберігати `token_hash`, не plaintext.
2. Показувати token/start URL один раз після створення або генерувати URL сервером.
3. Інвалідувати попередні невикористані токени користувача при створенні нового.

## Low / Defense-in-depth

### SEC-012: Немає явної production env validation для критичних секретів

Severity: Low/Medium

Location: `src/env.ts:3-46`

Evidence: критичні env мають `.default("")`, включно з `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`.

Impact: production може стартувати з порожніми секретами, а частина route handlers при цьому відкривається або падає runtime-помилками.

Fix: розділити public/client env і server env; у production вимагати непорожні секрети для увімкнених функцій; не імпортувати server-only env у client-bundled компоненти.

### SEC-013: Прямий Supabase client залишається частиною security boundary

Severity: Low/Medium

Location: `src/lib/supabase/server.ts:9`, `supabase/migrations/20260429171000_gate_2_database_access.sql:360-604`

Impact: браузер має anon key і user JWT, тому RLS/grants є реальним API-контрактом, не лише підтримкою для server actions. Будь-яка надто широка RLS policy може бути використана напряму, навіть якщо UI не показує кнопку.

Fix: додати RLS regression tests з ролями `manager`, `marketing`, `leader`, `admin`; тестувати не лише UI, а прямі insert/update/select/delete з Supabase client.

## Що виглядає добре

1. Приватний Storage bucket `case-files`, `public = false`.
2. Download route віддає файли як attachment і `Cache-Control: private, no-store`.
3. Не знайдено `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `localStorage/sessionStorage` для токенів.
4. `npm audit --audit-level=moderate` не знайшов відомих вразливостей у поточному lockfile.
5. Middleware закриває приватні page routes, але API/Server Actions все одно мають мати власні server-side перевірки.

## План закриття

### Gate S1: Emergency secrets & endpoint lockdown

1. Ротувати Supabase service role/JWT secret, anon key, `CRON_SECRET`, Telegram webhook secret.
2. Почистити `.env.example` до плейсхолдерів.
3. Зробити cron і Telegram webhook fail-closed при порожніх секретах.
4. `stage-reminders`: GET -> POST.
5. Додати базовий rate limit для `/login`, `/api/telegram/webhook`, `/api/notifications/deliver`, `/api/cases/stage-reminders`.

Перевірка: lint, typecheck, build; ручний виклик endpoint-ів без secret має давати 401/503; з правильним Bearer token має працювати.

### Gate S2: RLS hardening

1. Перепроєктувати `cases_update_by_access`.
2. Забрати прямий broad update на `cases` або замінити на вузькі RPC.
3. Визначити матрицю полів за ролями.
4. Прибрати service-role city creation із case action.
5. Додати RLS тести для прямого Supabase API.

Перевірка: SQL migration у `supabase/migrations`, локальні RLS tests, ручні сценарії ролей.

### Gate S3: Browser/file/export hardening

1. Додати security headers/CSP.
2. Закрити CSV formula injection.
3. Додати server-side file sniffing і quotas.
4. Хешувати Telegram link tokens.

Перевірка: build, smoke test, перевірка response headers, unit tests CSV/file validation.

### Gate S4: Operational security

1. Secret scanning у CI/pre-commit.
2. Dependabot/GitHub alerts або scheduled `npm audit`.
3. Supabase Auth hardening: rate limits, MFA для admin/leader, password policy.
4. Audit logging для admin role changes, failed cron/webhook auth, suspicious login attempts.

## Не зроблено в цьому аудиті

1. Не застосовувались міграції до Supabase.
2. Не запускався Vercel staging/preview.
3. Не робився GitHub push.
4. Не перевірялись реальні production headers/runtime config, бо це не видно з локального repo.
