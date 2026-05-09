import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { getMarketingTone, getPriorityTone, getProjectTone, getStageTone, StatusPill } from "@/components/ui/status-pill";
import { formatDateTime } from "@/lib/cases/format";
import {
  type CaseRow,
  type DirectoryOption,
  marketingStatusOptions,
  projectStageOptions,
  projectStatusOptions,
} from "@/lib/cases/types";
import { getProjectStage, isMarketingTransferred } from "@/lib/cases/helpers";
import { getPermission, getPriority } from "@/lib/reports/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CasesPageProps = {
  searchParams: Promise<{
    q?: string;
    project_status?: string;
    marketing_status?: string;
    segment_id?: string;
    city_id?: string;
    stage?: string;
    view?: string;
  }>;
};

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (search) {
    query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
  }

  if (params.project_status) {
    query = query.eq("project_status", params.project_status);
  }

  if (params.marketing_status) {
    query = query.eq("marketing_status", params.marketing_status);
  }

  if (params.segment_id) {
    query = query.eq("segment_id", params.segment_id);
  }

  if (params.city_id) {
    query = query.eq("city_id", params.city_id);
  }

  const [{ data: cases, error }, { data: segments }, { data: cities }] = await Promise.all([
    query,
    supabase.from("case_segments").select("id,name").order("sort_order"),
    supabase.from("cities").select("id,name").order("sort_order"),
  ]);
  const typedCases = ((cases ?? []) as unknown as CaseRow[]).filter((caseItem) => {
    if (params.stage && getProjectStage(caseItem) !== params.stage) {
      return false;
    }

    if (params.view === "mine" && user?.id && caseItem.owner_user_id !== user.id) {
      return false;
    }

    if (params.view === "hot" && getPriority(caseItem) !== "Гарячий кейс") {
      return false;
    }

    if (params.view === "incomplete" && !needsDetails(caseItem)) {
      return false;
    }

    return true;
  });

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Кейси" description="Табличний список для швидкого перегляду статусу, пріоритету, міста, менеджера і готовності до зйомки." />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href="/reports/export.xlsx">Вивантажити в Excel</Link>
          </Button>
          <Button asChild>
            <Link href="/cases/new">
              <Plus className="size-4" aria-hidden="true" />
              Додати кейс
            </Link>
          </Button>
        </div>
      </div>

      <form className="mb-5 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3 xl:grid-cols-[1.4fr_repeat(5,1fr)_auto]">
        <label className="text-sm font-medium">
          Пошук
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-md border bg-background pl-9 pr-3"
              defaultValue={search}
              name="q"
              placeholder="Назва або опис"
            />
          </div>
        </label>
        <FilterSelect label="Статус кейсу" name="project_status" options={projectStatusOptions} value={params.project_status} />
        <FilterSelect label="Маркетинг" name="marketing_status" options={marketingStatusOptions} value={params.marketing_status} />
        <FilterSelect label="Стадія" name="stage" options={projectStageOptions} value={params.stage} />
        <DirectorySelect label="Сегмент" name="segment_id" options={(segments ?? []) as DirectoryOption[]} value={params.segment_id} />
        <DirectorySelect label="Місто" name="city_id" options={(cities ?? []) as DirectoryOption[]} value={params.city_id} />
        <div className="flex items-end">
          <Button className="w-full" type="submit">
            Застосувати
          </Button>
        </div>
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        <QuickTab active={!params.view || params.view === "all"} href="/cases" label="Всі" />
        <QuickTab active={params.view === "mine"} href="/cases?view=mine" label="Мої" />
        <QuickTab active={params.view === "hot"} href="/cases?view=hot" label="Гарячі" />
        <QuickTab active={params.view === "incomplete"} href="/cases?view=incomplete" label="Доповнити" />
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Не вдалося завантажити кейси. Перевірте підключення до бази.
        </p>
      ) : null}

      <section className="animate-fade-in overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="hidden min-w-0 border-b bg-muted/60 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground lg:grid lg:grid-cols-[minmax(260px,2fr)_minmax(100px,0.7fr)_minmax(150px,0.9fr)_minmax(150px,0.8fr)_minmax(150px,0.9fr)_minmax(170px,0.9fr)] lg:gap-4">
          <span className="flex items-center gap-1">Кейс <InfoHint label="Назва кейсу, короткий опис і сегмент." /></span>
          <span className="flex items-center gap-1">Місто <InfoHint label="Місто, де відбувається проєкт або монтаж." /></span>
          <span className="flex items-center gap-1">Менеджер <InfoHint label="Відповідальний менеджер за кейс." /></span>
          <span className="flex items-center gap-1">
            Оцінка
            <InfoHint label="Автоматичний скоринг за чекпунктами кандидата на зйомку." />
          </span>
          <span className="flex items-center gap-1">Статус <InfoHint label="Поточний статус кейсу і статус маркетингу." /></span>
          <span className="flex items-center gap-1">Стадія <InfoHint label="Поточний етап проєкту. Якщо тиждень немає змін, менеджер отримає нагадування." /></span>
        </div>

        {typedCases.length ? (
          typedCases.map((caseItem) => <CaseTableRow caseItem={caseItem} key={caseItem.id} />)
        ) : (
          <div className="p-8 text-center">
            <h2 className="text-lg font-semibold">Кейсів не знайдено</h2>
            <p className="mt-2 text-sm text-muted-foreground">Змініть фільтри або додайте перший кейс.</p>
          </div>
        )}
      </section>
    </>
  );
}

function CaseTableRow({ caseItem }: { caseItem: CaseRow }) {
  const priority = getPriority(caseItem);
  const permission = getPermission(caseItem);
  const stage = getProjectStage(caseItem);
  const isInMarketing = isMarketingTransferred(caseItem);
  const incomplete = needsDetails(caseItem);

  return (
    <Link
      className={`grid min-w-0 gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/40 lg:grid-cols-[minmax(260px,2fr)_minmax(100px,0.7fr)_minmax(150px,0.9fr)_minmax(150px,0.8fr)_minmax(150px,0.9fr)_minmax(170px,0.9fr)] lg:items-start lg:gap-4 ${isInMarketing ? "border-l-4 border-l-violet-400" : ""}`}
      href={`/cases/${caseItem.id}`}
    >
      <div className="min-w-0">
        <h2 className="break-words font-semibold leading-5">{caseItem.title}</h2>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{caseItem.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">{caseItem.case_segments?.name ?? "Без сегмента"} · {formatDateTime(caseItem.updated_at)}</p>
      </div>
      <MobileMeta label="Місто" value={caseItem.cities?.name ?? "Не вибрано"} />
      <MobileMeta label="Менеджер" value={caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо"} />
      <div className="flex min-w-0 flex-col items-start gap-1">
        <StatusPill className="break-words" tone={getPriorityTone(priority)}>{caseItem.score ?? 0} · {priority}</StatusPill>
        {incomplete ? <StatusPill tone="orange">Доповнити</StatusPill> : null}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <StatusPill className="break-words" tone={getProjectTone(caseItem.project_status ?? "Новий")}>{caseItem.project_status ?? "Новий"}</StatusPill>
        <span className="flex items-center text-sm" title={`Дозвіл: ${permission || "Не вказано"}`}>
          {permission === "Так" ? "📷" : permission === "Ні" ? "🚫" : "❓"}
        </span>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <StagePill stage={stage} />
        {isInMarketing ? (
          <StatusPill className="break-words" tone={getMarketingTone(caseItem.marketing_status ?? "Новий")}>{caseItem.marketing_status}</StatusPill>
        ) : null}
      </div>
    </Link>
  );
}

function QuickTab({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Button asChild size="sm" variant={active ? "default" : "outline"}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}

function needsDetails(caseItem: CaseRow) {
  const monitoring = caseItem.metadata?.marketingMonitoring;
  const scoringInput = caseItem.metadata?.scoringInput;
  const filled = [
    caseItem.title,
    caseItem.summary,
    caseItem.city_id,
    caseItem.segment_id,
    monitoring?.projectStage,
    monitoring?.stagePlannedDate || monitoring?.keyDate,
    scoringInput && typeof scoringInput === "object" ? scoringInput.hasClientTask : null,
    scoringInput && typeof scoringInput === "object" ? scoringInput.hasSprofSolution : null,
    scoringInput && typeof scoringInput === "object" ? scoringInput.hasMetricOrEffect : null,
    scoringInput && typeof scoringInput === "object" ? scoringInput.hasVisualHook : null,
  ].filter(Boolean).length;

  return filled < 7;
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: string[];
  value?: string;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={value ?? ""} name={name}>
        <option value="">Усі</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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

function MobileMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm lg:block">
      <span className="text-muted-foreground lg:hidden">{label}</span>
      <span className="min-w-0 break-words text-right font-medium lg:text-left lg:font-normal">{value}</span>
    </div>
  );
}

function StagePill({ stage }: { stage: string }) {
  return (
    <StatusPill className="break-words" tone={getStageTone(stage)}>
      {stage || "Без стадії"}
    </StatusPill>
  );
}
