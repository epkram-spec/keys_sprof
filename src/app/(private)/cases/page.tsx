import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/cases/format";
import {
  type CaseRow,
  type DirectoryOption,
  marketingStatusOptions,
  projectStatusOptions,
} from "@/lib/cases/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CasesPageProps = {
  searchParams: Promise<{
    q?: string;
    project_status?: string;
    marketing_status?: string;
    segment_id?: string;
    city_id?: string;
  }>;
};

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const search = params.q?.trim() ?? "";

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
  const typedCases = (cases ?? []) as unknown as CaseRow[];

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Кейси" description="Пошук, фільтри і робочий список потенційних кейсів." />
        <Button asChild>
          <Link href="/cases/new">
            <Plus className="size-4" aria-hidden="true" />
            Додати кейс
          </Link>
        </Button>
      </div>

      <form className="mb-5 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1.4fr_repeat(4,1fr)_auto]">
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
        <FilterSelect
          label="Статус маркетингу"
          name="marketing_status"
          options={marketingStatusOptions}
          value={params.marketing_status}
        />
        <DirectorySelect label="Сегмент" name="segment_id" options={(segments ?? []) as DirectoryOption[]} value={params.segment_id} />
        <DirectorySelect label="Місто" name="city_id" options={(cities ?? []) as DirectoryOption[]} value={params.city_id} />
        <div className="flex items-end">
          <Button className="w-full" type="submit">
            Застосувати
          </Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Не вдалося завантажити кейси. Перевірте підключення до бази.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr] gap-4 border-b bg-muted/60 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground max-md:hidden">
          <span>Кейс</span>
          <span>Статус</span>
          <span>Маркетинг</span>
          <span>Оновлено</span>
        </div>
        {typedCases.length ? (
          typedCases.map((caseItem) => (
            <Link
              className="grid gap-2 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/50 md:grid-cols-[1.5fr_0.9fr_0.9fr_0.7fr] md:gap-4"
              href={`/cases/${caseItem.id}`}
              key={caseItem.id}
            >
              <div>
                <h2 className="font-semibold">{caseItem.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{caseItem.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {caseItem.case_segments?.name ?? "Без сегмента"} · {caseItem.cities?.name ?? "Без міста"}
                </p>
              </div>
              <StatusPill>{caseItem.project_status ?? "Новий"}</StatusPill>
              <StatusPill>{caseItem.marketing_status ?? "Не передано"}</StatusPill>
              <span className="text-sm text-muted-foreground">{formatDateTime(caseItem.updated_at)}</span>
            </Link>
          ))
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

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="h-fit w-fit rounded-md border bg-background px-2.5 py-1 text-sm font-medium text-foreground">
      {children}
    </span>
  );
}
