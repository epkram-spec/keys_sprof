import Link from "next/link";
import { Activity, AlertTriangle, CalendarDays, Flame, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import type { AppRole } from "@/lib/auth/types";
import type { CaseRow } from "@/lib/cases/types";
import { buildReportSummary } from "@/lib/reports/summary";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
  const monitoringMissing = cases.filter(needsMarketingMonitoring).length;
  const marketingSignals = cases.filter(hasMarketingSignal).length;
  const recentCases = cases.slice(0, 5);

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

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold">Пульт сьогодні</h2>
            <span className="text-sm text-muted-foreground">Підсвічені блоки потребують уваги</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetric icon={Activity} label="Усього" value={summary.total} />
            <OverviewMetric active={newCases > 0} icon={Sparkles} label="Нові" value={newCases} />
            <OverviewMetric active={summary.hot > 0} icon={Flame} label="Гарячі" value={summary.hot} />
            <OverviewMetric active={transferred > 0} label="Перевірити" value={transferred} />
            <OverviewMetric label="Потенційні" value={summary.potential} />
            <OverviewMetric label="Спостерігаємо" value={summary.observing} />
            <OverviewMetric active={summary.upcomingLaunch > 0} icon={CalendarDays} label="7 днів" value={summary.upcomingLaunch} />
            <OverviewMetric active={monitoringMissing > 0} icon={AlertTriangle} label="Доповнити" value={monitoringMissing} />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="flex items-center gap-1 text-base font-semibold">
            Маркетингові сигнали
            <InfoHint label="Кейси, де є оплата або передоплата, затверджена комплектація, важлива дата, гучний обʼєкт або великий чек." />
          </h2>
          <p className="mt-3 text-4xl font-semibold text-primary">{marketingSignals}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Якщо бракує оплати, комплектації або ключової дати, кейс потрапляє у блок доповнення.
          </p>
          <Button asChild className="mt-4 w-full" variant="secondary">
            <Link href="/cases">Перевірити кейси</Link>
          </Button>
        </div>
      </section>

      <section className="mt-5 rounded-lg border bg-card shadow-sm">
        <div className="flex flex-col gap-1 border-b bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold">Останні активні кейси</h2>
          <span className="text-sm text-muted-foreground">Оновлення з бази</span>
        </div>
        <div className="divide-y">
          {recentCases.length ? (
            recentCases.map((caseItem) => (
              <Link className="grid gap-2 px-4 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_auto]" href={`/cases/${caseItem.id}`} key={caseItem.id}>
                <div className="min-w-0">
                  <h3 className="break-words font-medium">{caseItem.title}</h3>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{caseItem.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <Badge>{caseItem.score ?? 0} балів</Badge>
                  <Badge>{caseItem.marketing_status ?? "Новий"}</Badge>
                </div>
              </Link>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">Кейсів поки немає.</p>
          )}
        </div>
      </section>
    </>
  );
}

function OverviewMetric({
  active,
  icon: Icon,
  label,
  value,
}: {
  active?: boolean;
  icon?: typeof Activity;
  label: string;
  value: number;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3 transition-colors",
        active && "border-primary/40 bg-primary/10 shadow-sm",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{label}</span>
        {Icon ? <Icon className={cn("size-4", active && "text-primary")} aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {active ? <p className="mt-1 text-xs font-medium text-primary">Є зміна</p> : null}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium">{children}</span>;
}

function getMonitoring(caseItem: CaseRow) {
  const monitoring = caseItem.metadata.marketingMonitoring;
  return monitoring && typeof monitoring === "object" ? (monitoring as Record<string, unknown>) : {};
}

function hasMarketingSignal(caseItem: CaseRow) {
  const monitoring = getMonitoring(caseItem);
  return (
    monitoring.paymentStatus === "Передоплата" ||
    monitoring.paymentStatus === "Оплата" ||
    monitoring.equipmentApproved === true ||
    typeof monitoring.keyDate === "string" && monitoring.keyDate.length > 0 ||
    monitoring.isHighProfile === true ||
    monitoring.bigCheck === true
  );
}

function needsMarketingMonitoring(caseItem: CaseRow) {
  if (caseItem.marketing_status === "Опубліковано" || caseItem.marketing_status === "Архів") {
    return false;
  }

  const monitoring = getMonitoring(caseItem);
  const hasPaymentOrPackage =
    monitoring.paymentStatus === "Передоплата" ||
    monitoring.paymentStatus === "Оплата" ||
    monitoring.equipmentApproved === true;
  const hasKeyDate = typeof monitoring.keyDate === "string" && monitoring.keyDate.length > 0;
  return !hasPaymentOrPackage || !hasKeyDate;
}
