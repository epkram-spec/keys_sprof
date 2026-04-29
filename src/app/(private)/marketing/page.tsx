import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { updateMarketingStatusAction } from "@/app/(private)/marketing/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/cases/format";
import { type CaseRow, type DirectoryOption, marketingStatusOptions } from "@/lib/cases/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MarketingPageProps = {
  searchParams: Promise<{
    city_id?: string;
    manager_id?: string;
    priority?: string;
    launch_date?: string;
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
const permissionOptions = ["Так", "Уточнюється", "Ні"];

const successMessages: Record<string, string> = {
  status_updated: "Статус маркетингу оновлено.",
  no_changes: "Статус уже був таким.",
};

const errorMessages: Record<string, string> = {
  invalid_status: "Некоректний статус маркетингу.",
  forbidden: "У вас немає права змінювати статус маркетингу.",
  case_not_found: "Кейс не знайдено.",
  update_failed: "Не вдалося оновити статус.",
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
    supabase.from("profiles").select("id,email,display_name").eq("role", "manager").order("email"),
  ]);

  const filteredCases = ((cases ?? []) as unknown as CaseRow[]).filter((caseItem) => {
    const metadata = caseItem.metadata ?? {};
    const priority = typeof metadata.priority === "string" ? metadata.priority : "Спостерігаємо";
    const scoringInput =
      metadata.scoringInput && typeof metadata.scoringInput === "object"
        ? (metadata.scoringInput as Record<string, unknown>)
        : {};
    const launchDate = typeof scoringInput.launchDate === "string" ? scoringInput.launchDate : "";
    const permissionStatus =
      typeof scoringInput.permissionStatus === "string" ? scoringInput.permissionStatus : "";

    if (params.priority && priority !== params.priority) {
      return false;
    }

    if (params.launch_date && launchDate !== params.launch_date) {
      return false;
    }

    if (params.permission_status && permissionStatus !== params.permission_status) {
      return false;
    }

    return true;
  });

  const groupedCases = marketingStatusOptions.map((status) => ({
    status,
    cases: filteredCases.filter((caseItem) => (caseItem.marketing_status ?? "Новий") === status),
  }));

  return (
    <>
      <PageHeader
        title="Маркетинг"
        description="Коротка панель статусів для кейсів без задачника і складного календаря."
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

      <form className="mb-5 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <DirectorySelect label="Місто" name="city_id" options={(cities ?? []) as DirectoryOption[]} value={params.city_id} />
        <ManagerSelect managers={(managers ?? []) as ManagerOption[]} value={params.manager_id} />
        <SimpleSelect label="Пріоритет" name="priority" options={priorityOptions} value={params.priority} />
        <label className="text-sm font-medium">
          Дата монтажу
          <input
            className="mt-2 h-10 w-full rounded-md border bg-background px-3"
            defaultValue={params.launch_date ?? ""}
            name="launch_date"
            type="date"
          />
        </label>
        <SimpleSelect
          label="Дозвіл на зйомку"
          name="permission_status"
          options={permissionOptions}
          value={params.permission_status}
        />
        <div className="md:col-span-5">
          <Button type="submit">Застосувати фільтри</Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Не вдалося завантажити панель маркетингу.
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-5">
        {groupedCases.map((group) => (
          <div className="min-h-40 rounded-lg border bg-card" key={group.status}>
            <div className="border-b bg-muted/60 px-3 py-3">
              <h2 className="text-sm font-semibold">{group.status}</h2>
              <p className="text-xs text-muted-foreground">{group.cases.length} кейсів</p>
            </div>
            <div className="space-y-3 p-3">
              {group.cases.length ? (
                group.cases.map((caseItem) => <MarketingCard caseItem={caseItem} key={caseItem.id} />)
              ) : (
                <p className="text-sm text-muted-foreground">Немає кейсів.</p>
              )}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function MarketingCard({ caseItem }: { caseItem: CaseRow }) {
  const priority = typeof caseItem.metadata.priority === "string" ? caseItem.metadata.priority : "Спостерігаємо";
  const scoringInput =
    caseItem.metadata.scoringInput && typeof caseItem.metadata.scoringInput === "object"
      ? (caseItem.metadata.scoringInput as Record<string, unknown>)
      : {};
  const launchDate = typeof scoringInput.launchDate === "string" ? scoringInput.launchDate : "";
  const permissionStatus = typeof scoringInput.permissionStatus === "string" ? scoringInput.permissionStatus : "";

  return (
    <article className="rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link className="font-semibold hover:underline" href={`/cases/${caseItem.id}`}>
            {caseItem.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{caseItem.summary}</p>
        </div>
        <span className="rounded-md border bg-card px-2 py-1 text-xs font-semibold">{caseItem.score ?? 0}</span>
      </div>

      <dl className="mt-3 grid gap-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Менеджер</dt>
          <dd className="text-right text-foreground">{caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Місто</dt>
          <dd className="text-right text-foreground">{caseItem.cities?.name ?? "Не вибрано"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Пріоритет</dt>
          <dd className="text-right text-foreground">{priority}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Дата монтажу</dt>
          <dd className="text-right text-foreground">{launchDate || "Не вказано"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Дозвіл</dt>
          <dd className="text-right text-foreground">{permissionStatus || "Не вказано"}</dd>
        </div>
      </dl>

      <form action={updateMarketingStatusAction} className="mt-3 grid gap-2">
        <input name="caseId" type="hidden" value={caseItem.id} />
        <select
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          defaultValue={caseItem.marketing_status ?? "Новий"}
          name="marketingStatus"
        >
          {marketingStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <Button size="sm" type="submit" variant="secondary">
          <ArrowRight className="size-4" aria-hidden="true" />
          Змінити статус
        </Button>
      </form>
      <p className="mt-2 text-[11px] text-muted-foreground">Оновлено: {formatDateTime(caseItem.updated_at)}</p>
    </article>
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
