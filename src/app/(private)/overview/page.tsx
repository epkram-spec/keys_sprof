import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/auth/types";
import type { CaseRow } from "@/lib/cases/types";
import { buildReportSummary } from "@/lib/reports/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OverviewPage() {
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
  const newCases = cases.filter((caseItem) => (caseItem.project_status ?? "Новий") === "Новий").length;
  const transferred = cases.filter((caseItem) => caseItem.marketing_status === "Перевірити").length;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Огляд"
          description="Живі показники з бази: скільки кейсів є, що вже гаряче і що треба передати або перевірити."
        />
        <Button asChild variant="secondary">
          <Link href="/cases">Відкрити кейси</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Усього кейсів" value={String(summary.total)} />
        <StatCard label="Нові кейси" value={String(newCases)} />
        <StatCard label="Гарячі" value={String(summary.hot)} />
        <StatCard label="Потенційні" value={String(summary.potential)} />
        <StatCard label="Спостерігаємо" value={String(summary.observing)} />
        <StatCard label="Без дозволу" value={String(summary.withoutPermission)} />
        <StatCard label="Передано в маркетинг" value={String(transferred)} />
        <StatCard label="Монтаж 7 днів" value={String(summary.upcomingLaunch)} />
      </div>
    </>
  );
}
