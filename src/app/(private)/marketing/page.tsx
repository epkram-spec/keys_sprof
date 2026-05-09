import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowRight } from "lucide-react";

import { updateMarketingStatusAction } from "@/app/(private)/marketing/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { getMarketingTone, getPermissionTone, getPriorityTone, StatusPill } from "@/components/ui/status-pill";
import { formatDateTime } from "@/lib/cases/format";
import { normalizeLegacyScoringInput } from "@/lib/cases/scoring";
import { type CaseRow, type DirectoryOption, marketingStatusOptions } from "@/lib/cases/types";
import { getPermission, getPriority } from "@/lib/reports/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MarketingPageProps = {
  searchParams: Promise<{
    city_id?: string;
    manager_id?: string;
    priority?: string;
    dates_ready?: string;
    permission_status?: string;
    error?: string;
    success?: string;
  }>;
};

type ManagerOption = {
  id: string;
  email: string;
  display_name: string | null;
};

const priorityOptions = ["Гарячий кейс", "Потенційний кейс", "Спостерігаємо"];
const permissionOptions = ["Так", "Ні"];

const successMessages: Record<string, string> = {
  status_updated: "Статус маркетингу оновлено.",
  no_changes: "Статус уже був таким.",
};

const errorMessages: Record<string, string> = {
  invalid_status: "Некоректний статус маркетингу.",
  forbidden: "У вас немає права змінювати статус маркетингу.",
  case_not_found: "Кейс не знайдено.",
  update_failed: "Не вдалося оновити статус.",
  shooting_date_required: "Вкажіть дату зйомки для статусу «Зйомку заплановано».",
};

export default async function MarketingPage({ searchParams }: MarketingPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("cases")
    .select(
      `
        id,title,summary,owner_user_id,created_by_user_id,assigned_marketing_user_id,
        segment_id,city_id,project_status,marketing_status,score,metadata,created_at,updated_at,archived_at,
        case_segments(name),
        cities(name),
        owner:profiles!cases_owner_user_id_fkey(display_name,email)
      `,
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (params.city_id) {
    query = query.eq("city_id", params.city_id);
  }

  if (params.manager_id) {
    query = query.eq("owner_user_id", params.manager_id);
  }

  const [{ data: cases, error }, { data: cities }, { data: managers }] = await Promise.all([
    query,
    supabase.from("cities").select("id,name").order("sort_order"),
    supabase.from("profiles").select("id,email,display_name").in("role", ["manager", "admin", "leader"]).order("email"),
  ]);

  const filteredCases = ((cases ?? []) as unknown as CaseRow[]).filter((caseItem) => {
    const priority = getPriority(caseItem);
    const permission = getPermission(caseItem);
    const scoringInput = getScoringInput(caseItem);
    const datesReady = scoringInput.hasFeasibleDates === true;

    if (params.priority && priority !== params.priority) {
      return false;
    }

    if (params.dates_ready && String(datesReady) !== params.dates_ready) {
      return false;
    }

    if (params.permission_status && permission !== params.permission_status) {
      return false;
    }

    return true;
  });

  const groupedCases = marketingStatusOptions
    .map((status) => ({
      status,
      cases: filteredCases.filter((caseItem) => (caseItem.marketing_status ?? "Новий") === status),
    }))
    .filter((group) => group.cases.length > 0 || group.status === "Новий" || group.status === "Перевірити");

  return (
    <>
      <PageHeader
        title="Маркетинг"
        description="Зручний робочий список за статусами: без вузьких колонок, з нормальним читанням на телефоні та компʼютері."
      />

      {params.success ? (
        <p className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {successMessages[params.success] ?? "Дію виконано."}
        </p>
      ) : null}
      {params.error ? (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessages[params.error] ?? "Сталася помилка."}
        </p>
      ) : null}

      <form className="mb-5 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3 xl:grid-cols-6">
        <DirectorySelect label="Місто" name="city_id" options={(cities ?? []) as DirectoryOption[]} value={params.city_id} />
        <ManagerSelect managers={(managers ?? []) as ManagerOption[]} value={params.manager_id} />
        <SimpleSelect label="Пріоритет" name="priority" options={priorityOptions} value={params.priority} />
        <SimpleSelect label="Дати" name="dates_ready" options={[["true", "Є дати"], ["false", "Без дат"]]} value={params.dates_ready} />
        <SimpleSelect label="Дозвіл" name="permission_status" options={permissionOptions} value={params.permission_status} />
        <div className="flex items-end">
          <Button className="w-full" type="submit">Застосувати</Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Не вдалося завантажити панель маркетингу.
        </p>
      ) : null}

      <section className="animate-fade-in space-y-4">
        {groupedCases.map((group) => {
          const accentClass = getGroupAccent(group.status);
          return (
            <div className={`rounded-lg border bg-card shadow-sm ${accentClass}`} key={group.status}>
              <div className="flex flex-col gap-2 border-b bg-muted/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <StatusPill className="text-sm" tone={getMarketingTone(group.status)}>{group.status}</StatusPill>
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {group.cases.length}
                  </span>
                </div>
              </div>
              <div className="grid gap-3 p-3 2xl:grid-cols-2">
                {group.cases.length ? (
                  group.cases.map((caseItem) => <MarketingRow caseItem={caseItem} key={caseItem.id} />)
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">Немає кейсів.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

function MarketingRow({ caseItem }: { caseItem: CaseRow }) {
  const priority = getPriority(caseItem);
  const permission = getPermission(caseItem);
  const scoringInput = getScoringInput(caseItem);
  const datesReady = scoringInput.hasFeasibleDates === true;

  return (
    <article className="min-w-0 rounded-md border bg-background p-3">
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <Link className="break-words font-semibold hover:underline" href={`/cases/${caseItem.id}`}>
            {caseItem.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{caseItem.summary}</p>
          <div className="mt-3 grid min-w-0 gap-2 text-xs text-muted-foreground md:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
            <Meta label="Менеджер" value={caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо"} />
            <Meta label="Місто" value={caseItem.cities?.name ?? "Не вибрано"} />
            <Meta label="Пріоритет" tone={getPriorityTone(priority)} value={`${caseItem.score ?? 0} · ${priority}`} />
            <Meta label="Оновлено" value={formatDateTime(caseItem.updated_at)} />
            <Meta label="Статус змінено" value={getMarketingStatusChangedAt(caseItem)} />
            <Meta label="Дата зйомки" value={getPlannedShootingDate(caseItem) || "Не вказано"} />
            <Meta label="Дозвіл" tone={getPermissionTone(permission || "Ні")} value={permission || "Ні"} />
            <Meta label="Дати" tone={datesReady ? "blue" : "orange"} value={datesReady ? "Є дати" : "Без дат"} />
          </div>
        </div>
        <form action={updateMarketingStatusAction} className="grid gap-2 self-start">
          <input name="caseId" type="hidden" value={caseItem.id} />
          <label className="text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1">
              Новий статус
              <InfoHint label="Маркетинг може змінювати цей статус. Кожна зміна записується в журнал кейсу." />
            </span>
            <select
              className="mt-2 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground"
              defaultValue={caseItem.marketing_status ?? "Новий"}
              name="marketingStatus"
            >
              {marketingStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Дата зйомки
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground"
              defaultValue={getPlannedShootingDate(caseItem)}
              name="plannedShootingDate"
              type="date"
            />
          </label>
          <Button size="sm" type="submit" variant="secondary">
            <ArrowRight className="size-4" aria-hidden="true" />
            Змінити статус
          </Button>
        </form>
        <div className="grid gap-2 xl:col-start-2">
          <QuickStatusButton caseId={caseItem.id} status="Готово до зйомки">
            Прийняти в роботу
          </QuickStatusButton>
          <QuickStatusButton caseId={caseItem.id} status="Погодити зйомку" variant="outline">
            Повернути менеджеру
          </QuickStatusButton>
          <QuickStatusButton caseId={caseItem.id} status="Опубліковано" variant="outline">
            Опублікувати
          </QuickStatusButton>
        </div>
      </div>
    </article>
  );
}

function QuickStatusButton({
  caseId,
  children,
  status,
  variant = "secondary",
}: {
  caseId: string;
  children: React.ReactNode;
  status: string;
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  return (
    <form action={updateMarketingStatusAction}>
      <input name="caseId" type="hidden" value={caseId} />
      <input name="marketingStatus" type="hidden" value={status} />
      <Button className="w-full justify-start" size="sm" type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}

function Meta({ label, tone, value }: { label: string; tone?: ComponentProps<typeof StatusPill>["tone"]; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 rounded-md bg-muted/35 px-2 py-1">
      <span>{label}</span>
      {tone ? (
        <StatusPill className="max-w-full break-words text-right" tone={tone}>{value}</StatusPill>
      ) : (
        <span className="min-w-0 break-words text-right font-medium text-foreground">{value}</span>
      )}
    </div>
  );
}

function DirectorySelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: DirectoryOption[];
  value?: string;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={value ?? ""} name={name}>
        <option value="">Усі</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ManagerSelect({ managers, value }: { managers: ManagerOption[]; value?: string }) {
  return (
    <label className="text-sm font-medium">
      Менеджер
      <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={value ?? ""} name="manager_id">
        <option value="">Усі</option>
        {managers.map((manager) => (
          <option key={manager.id} value={manager.id}>
            {manager.display_name ?? manager.email}
          </option>
        ))}
      </select>
    </label>
  );
}

function SimpleSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: string[] | Array<[string, string]>;
  value?: string;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={value ?? ""} name={name}>
        <option value="">Усі</option>
        {options.map((option) => {
          const optionValue = Array.isArray(option) ? option[0] : option;
          const optionLabel = Array.isArray(option) ? option[1] : option;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function getScoringInput(caseItem: CaseRow) {
  return caseItem.metadata?.scoringInput && typeof caseItem.metadata.scoringInput === "object"
    ? normalizeLegacyScoringInput(caseItem.metadata.scoringInput as Record<string, unknown>)
    : {};
}

function getPlannedShootingDate(caseItem: CaseRow) {
  const workflow = caseItem.metadata?.marketingWorkflow;
  if (workflow && typeof workflow === "object" && !Array.isArray(workflow)) {
    const value = (workflow as Record<string, unknown>).plannedShootingDate;
    return typeof value === "string" ? value.slice(0, 10) : "";
  }

  return "";
}

function getMarketingStatusChangedAt(caseItem: CaseRow) {
  const workflow = caseItem.metadata?.marketingWorkflow;
  if (workflow && typeof workflow === "object" && !Array.isArray(workflow)) {
    const value = (workflow as Record<string, unknown>).statusChangedAt;
    return typeof value === "string" ? formatDateTime(value) : "Не вказано";
  }

  return "Не вказано";
}

function getGroupAccent(status: string) {
  if (status === "Перевірити" || status === "Погодити зйомку") {
    return "border-l-4 border-l-orange-400";
  }

  if (status === "Готово до зйомки" || status === "Зйомку заплановано") {
    return "border-l-4 border-l-blue-400";
  }

  if (status === "Знято" || status === "Матеріали в обробці") {
    return "border-l-4 border-l-violet-400";
  }

  return "";
}
