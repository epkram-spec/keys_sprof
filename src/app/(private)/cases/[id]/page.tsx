import Link from "next/link";
import { notFound } from "next/navigation";

import { addCommentAction, transferToMarketingAction } from "@/app/(private)/cases/actions";
import { CaseForm } from "@/components/cases/case-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime, getMetadataText } from "@/lib/cases/format";
import type { CaseActivity, CaseComment, CaseRow, DirectoryOption } from "@/lib/cases/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CaseDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

const successMessages: Record<string, string> = {
  created: "Кейс додано.",
  updated: "Зміни збережено.",
  comment: "Коментар додано.",
  transfer: "Кейс передано в маркетинг зі статусом «Перевірити».",
};

const errorMessages: Record<string, string> = {
  required: "Заповніть обовʼязкові поля.",
  update: "Не вдалося зберегти зміни.",
  comment_required: "Напишіть текст коментаря.",
  comment: "Не вдалося додати коментар.",
  transfer: "Не вдалося передати кейс у маркетинг.",
};

export default async function CaseDetailsPage({ params, searchParams }: CaseDetailsPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [
    { data: caseItem },
    { data: comments },
    { data: activity },
    { data: segments },
    { data: cities },
  ] = await Promise.all([
    supabase
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
      .eq("id", id)
      .single(),
    supabase
      .from("case_comments")
      .select("id,body,created_at,author:profiles!case_comments_author_user_id_fkey(display_name,email)")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("case_activity_log")
      .select("id,action,metadata,created_at,actor:profiles!case_activity_log_actor_user_id_fkey(display_name,email)")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("case_segments").select("id,name").order("sort_order"),
    supabase.from("cities").select("id,name").order("sort_order"),
  ]);

  if (!caseItem) {
    notFound();
  }

  const typedCase = caseItem as unknown as CaseRow;
  const typedComments = (comments ?? []) as unknown as CaseComment[];
  const typedActivity = (activity ?? []) as unknown as CaseActivity[];

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost">
          <Link href="/cases">Назад до списку</Link>
        </Button>
      </div>

      <PageHeader title={typedCase.title} description="Картка кейсу, редагування, коментарі та журнал змін." />

      {query.success ? (
        <p className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {successMessages[query.success] ?? "Дію виконано."}
        </p>
      ) : null}
      {query.error ? (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessages[query.error] ?? "Сталася помилка. Спробуйте ще раз."}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <CaseSummary caseItem={typedCase} />
          <CaseForm
            caseItem={typedCase}
            cities={(cities ?? []) as DirectoryOption[]}
            mode="edit"
            segments={(segments ?? []) as DirectoryOption[]}
          />
        </div>

        <aside className="space-y-6">
          <TransferPanel caseId={typedCase.id} marketingStatus={typedCase.marketing_status} />
          <CommentsPanel caseId={typedCase.id} comments={typedComments} />
          <ActivityPanel activity={typedActivity} />
        </aside>
      </div>
    </>
  );
}

function CaseSummary({ caseItem }: { caseItem: CaseRow }) {
  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-4">
      <SummaryItem label="Статус кейсу" value={caseItem.project_status ?? "Новий"} />
      <SummaryItem label="Статус маркетингу" value={caseItem.marketing_status ?? "Не передано"} />
      <SummaryItem label="Сегмент" value={caseItem.case_segments?.name ?? "Не вибрано"} />
      <SummaryItem label="Місто" value={caseItem.cities?.name ?? "Не вибрано"} />
      <SummaryItem label="Власник" value={caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо"} />
      <SummaryItem label="Оцінка" value={caseItem.score === null ? "Не вказано" : String(caseItem.score)} />
      <SummaryItem label="Створено" value={formatDateTime(caseItem.created_at)} />
      <SummaryItem label="Оновлено" value={formatDateTime(caseItem.updated_at)} />
      <div className="md:col-span-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">Контекст</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Контакт: {getMetadataText(caseItem.metadata, "contactName") || "не вказано"} · Джерело:{" "}
          {getMetadataText(caseItem.metadata, "source") || "не вказано"}
        </p>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function TransferPanel({ caseId, marketingStatus }: { caseId: string; marketingStatus: string | null }) {
  const alreadyTransferred = marketingStatus === "Перевірити";

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Передача в маркетинг</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Кнопка встановлює статус маркетингу «Перевірити» і записує дію в журнал.
      </p>
      <form action={transferToMarketingAction} className="mt-4">
        <input name="caseId" type="hidden" value={caseId} />
        <Button className="w-full" disabled={alreadyTransferred} type="submit">
          {alreadyTransferred ? "Уже передано" : "Передати в маркетинг"}
        </Button>
      </form>
    </section>
  );
}

function CommentsPanel({ caseId, comments }: { caseId: string; comments: CaseComment[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Коментарі</h2>
      <form action={addCommentAction} className="mt-4 space-y-3">
        <input name="caseId" type="hidden" value={caseId} />
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
          name="body"
          placeholder="Додайте коментар"
          required
        />
        <Button type="submit">Додати коментар</Button>
      </form>
      <div className="mt-5 space-y-3">
        {comments.length ? (
          comments.map((comment) => (
            <article className="rounded-md border bg-background p-3" key={comment.id}>
              <p className="text-sm leading-6">{comment.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {comment.author?.display_name ?? comment.author?.email ?? "Користувач"} · {formatDateTime(comment.created_at)}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Коментарів ще немає.</p>
        )}
      </div>
    </section>
  );
}

function ActivityPanel({ activity }: { activity: CaseActivity[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Журнал змін</h2>
      <div className="mt-4 space-y-3">
        {activity.length ? (
          activity.map((item) => (
            <article className="rounded-md border bg-background p-3" key={item.id}>
              <p className="text-sm font-medium">{activityLabels[item.action] ?? item.action}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.actor?.display_name ?? item.actor?.email ?? "Система"} · {formatDateTime(item.created_at)}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Записів ще немає.</p>
        )}
      </div>
    </section>
  );
}

const activityLabels: Record<string, string> = {
  "case.created": "Кейс створено",
  "case.updated": "Кейс оновлено",
  "comment.created": "Коментар додано",
  "case.transferred_to_marketing": "Кейс передано в маркетинг",
};
