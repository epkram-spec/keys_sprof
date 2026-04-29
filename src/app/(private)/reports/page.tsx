import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/auth/types";
import type { CaseRow } from "@/lib/cases/types";
import { buildReportSummary } from "@/lib/reports/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("id", user?.id ?? "")
    .single<{ id: string; role: AppRole }>();

  const { data } = await supabase
    .from("cases")
    .select(
      `
        id,title,summary,owner_user_id,created_by_user_id,assigned_marketing_user_id,
        segment_id,city_id,project_status,marketing_status,score,metadata,created_at,updated_at,archived_at,
        cities(name),
        owner:profiles!cases_owner_user_id_fkey(display_name,email)
      `,
    )
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const cases = (data ?? []) as unknown as CaseRow[];
  const role = profile?.role ?? "manager";
  const summary = buildReportSummary(cases, role);
  const canExport = role === "leader" || role === "admin";

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Зведення"
          description="Короткі показники по кейсах без складної BI-аналітики."
        />
        {canExport ? (
          <Button asChild variant="secondary">
            <Link href="/reports/export.csv">Експорт CSV</Link>
          </Button>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Усього кейсів" value={summary.total} />
        <MetricCard label="Гарячі" value={summary.hot} />
        <MetricCard label="Потенційні" value={summary.potential} />
        <MetricCard label="Спостерігаємо" value={summary.observing} />
        <MetricCard label="Завислі" value={summary.stalled} />
        <MetricCard label="Без дозволу" value={summary.withoutPermission} />
        <MetricCard label="Монтаж/запуск 7 днів" value={summary.upcomingLaunch} />
        <MetricCard label="Опубліковані" value={summary.published} />
      </section>

      {role !== "manager" ? (
        <section className="mt-6 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Активність менеджерів</h2>
          <div className="mt-4 overflow-hidden rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Менеджер</th>
                  <th className="px-3 py-2">Кейсів</th>
                  <th className="px-3 py-2">Гарячі</th>
                  <th className="px-3 py-2">Опубліковані</th>
                </tr>
              </thead>
              <tbody>
                {summary.managerActivity.length ? (
                  summary.managerActivity.map((item) => (
                    <tr className="border-b last:border-b-0" key={item.ownerId}>
                      <td className="px-3 py-2 font-medium">{item.ownerName}</td>
                      <td className="px-3 py-2">{item.total}</td>
                      <td className="px-3 py-2">{item.hot}</td>
                      <td className="px-3 py-2">{item.published}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                      Даних ще немає.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Ваші базові показники</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Менеджер бачить тільки власні кейси й базову картину без загальної активності команди.
          </p>
        </section>
      )}
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </section>
  );
}
