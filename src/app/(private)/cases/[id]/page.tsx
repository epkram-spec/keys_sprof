import Link from "next/link";
import { notFound } from "next/navigation";

import { addCommentAction, transferToMarketingAction, uploadCaseFileAction } from "@/app/(private)/cases/actions";
import { CaseForm } from "@/components/cases/case-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getPriorityTone, getStageTone, StatusPill } from "@/components/ui/status-pill";
import { formatDateTime, getMetadataText } from "@/lib/cases/format";
import type { CaseFileRow } from "@/lib/cases/files";
import { scoringCriteria, type ScoringResult } from "@/lib/cases/scoring";
import { projectStageOptions, type CaseActivity, type CaseComment, type CaseRow, type DirectoryOption } from "@/lib/cases/types";
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
  file_uploaded: "Файл додано.",
};

const errorMessages: Record<string, string> = {
  required: "Заповніть обовʼязкові поля.",
  permission_comment: "Якщо зйомка заборонена, напишіть короткий коментар чому.",
  update: "Не вдалося зберегти зміни.",
  comment_required: "Напишіть текст коментаря.",
  comment: "Не вдалося додати коментар.",
  transfer: "Не вдалося передати кейс у маркетинг.",
  file_required: "Оберіть файл для додавання.",
  file_type: "Тип файлу не дозволений. Дозволено jpg, png, webp, pdf, mp4, mov.",
  file_access: "Немає доступу до цього кейсу.",
  file_upload: "Не вдалося додати файл.",
};

export default async function CaseDetailsPage({ params, searchParams }: CaseDetailsPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [
    { data: caseItem },
    { data: comments },
    { data: activity },
    { data: files },
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
    supabase
      .from("case_files")
      .select("id,case_id,uploaded_by_user_id,storage_bucket,storage_path,original_name,mime_type,size_bytes,created_at,uploader:profiles!case_files_uploaded_by_user_id_fkey(display_name,email)")
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
  const typedFiles = (files ?? []) as unknown as CaseFileRow[];

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
          <ScoringExplanation caseItem={typedCase} />
          <CaseForm
            caseItem={typedCase}
            cities={(cities ?? []) as DirectoryOption[]}
            mode="edit"
            segments={(segments ?? []) as DirectoryOption[]}
          />
        </div>

        <aside className="space-y-6">
          <TransferPanel caseId={typedCase.id} marketingStatus={typedCase.marketing_status} />
          <FilesPanel caseId={typedCase.id} files={typedFiles} />
          <CommentsPanel caseId={typedCase.id} comments={typedComments} />
          <ActivityPanel activity={typedActivity} />
        </aside>
      </div>
    </>
  );
}

function CaseSummary({ caseItem }: { caseItem: CaseRow }) {
  const priority = getPriority(caseItem);
  const monitoring = getMonitoring(caseItem);
  const scoringInput = getScoringInput(caseItem);
  const stage = getText(monitoring, "projectStage");
  const stagePlannedDate = getText(monitoring, "stagePlannedDate") || getText(monitoring, "keyDate");

  return (
    <section className="space-y-5 rounded-lg border bg-card p-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryItem label="Статус кейсу" value={caseItem.project_status ?? "Новий"} />
        <SummaryItem label="Статус маркетингу" value={caseItem.marketing_status ?? "Новий"} />
        <SummaryItem label="Сегмент" value={caseItem.case_segments?.name ?? "Не вибрано"} />
        <SummaryItem label="Місто" value={caseItem.cities?.name ?? "Не вибрано"} />
        <SummaryItem label="Власник" value={caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо"} />
        <SummaryItem label="Оцінка" value={caseItem.score === null ? "Не вказано" : String(caseItem.score)} />
        <SummaryItem label="Пріоритет" value={priority} />
        <SummaryItem label="Планова дата" value={stagePlannedDate || "Не вказано"} />
      </div>

      <div className="rounded-md border bg-background p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">Стадія проєкту</h2>
          <span className="text-sm text-muted-foreground">{stage || "Стадію не вказано"}</span>
        </div>
        <StageStepper currentStage={stage} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <TextSummary label="Задача" value={getText(scoringInput, "hasClientTask")} />
        <TextSummary label="Рішення SPROF" value={getText(scoringInput, "hasSprofSolution")} />
        <TextSummary label="Очікуваний результат" value={getText(scoringInput, "hasMetricOrEffect")} />
        <TextSummary label="Особливість проєкту" value={getText(scoringInput, "hasVisualHook")} />
      </div>

      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Контекст</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Контакт: {getMetadataText(caseItem.metadata, "contactName") || "не вказано"} · Джерело:{" "}
          {getMetadataText(caseItem.metadata, "source") || "не вказано"}
        </p>
      </div>
    </section>
  );
}

function StageStepper({ currentStage }: { currentStage: string }) {
  const currentIndex = projectStageOptions.indexOf(currentStage);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {projectStageOptions.map((stage, index) => {
        const isCurrent = stage === currentStage;
        const isDone = currentIndex >= 0 && index < currentIndex;
        return (
          <div className={isCurrent ? "" : isDone ? "opacity-80" : "opacity-60"} key={stage}>
            <StatusPill className="w-full justify-start text-left text-sm" tone={isCurrent ? getStageTone(stage) : isDone ? "green" : "slate"}>
            {stage}
            </StatusPill>
          </div>
        );
      })}
    </div>
  );
}

function TextSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-6">{value || "Не заповнено"}</p>
    </div>
  );
}

function FilesPanel({ caseId, files }: { caseId: string; files: CaseFileRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Файли і фото</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Дозволено: jpg, png, webp, pdf, mp4, mov. Файли не мають відкритих публічних URL.
      </p>
      <form action={uploadCaseFileAction} className="mt-4 space-y-3">
        <input name="caseId" type="hidden" value={caseId} />
        <input
          accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov,image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime"
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
          name="file"
          required
          type="file"
        />
        <Button type="submit">Додати файл</Button>
      </form>
      <div className="mt-5 space-y-3">
        {files.length ? (
          files.map((file) => (
            <article className="rounded-md border bg-background p-3" key={file.id}>
              <a className="font-medium hover:underline" href={`/cases/${caseId}/files/${file.id}`}>
                {file.original_name}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                {file.mime_type ?? "Тип не визначено"} · {formatFileSize(file.size_bytes)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Додав: {file.uploader?.display_name ?? file.uploader?.email ?? "Користувач"} ·{" "}
                {formatDateTime(file.created_at)}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Файлів ще немає.</p>
        )}
      </div>
    </section>
  );
}

function ScoringExplanation({ caseItem }: { caseItem: CaseRow }) {
  const scoring = getScoring(caseItem);

  if (!scoring) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Пояснення балів</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Пояснення зʼявиться після збереження кейсу з факторами скорингу.
        </p>
      </section>
    );
  }

  return (
    <details className="group rounded-lg border bg-card p-5">
      <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Пояснення балів</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {scoring.score} балів · {scoring.priority}
          </p>
        </div>
        <span className="text-sm font-medium text-primary group-open:hidden">Показати</span>
        <span className="hidden text-sm font-medium text-primary group-open:inline">Сховати</span>
      </summary>
      <div className="mt-4 grid gap-2 border-t pt-4">
        {scoring.details.map((item) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
            key={item.label}
          >
            <span className={item.matched ? "font-medium" : "text-muted-foreground"}>{getScoringLabel(item.label)}</span>
            <StatusPill tone={item.matched ? getPriorityTone(scoring.priority) : "slate"}>{item.matched ? `+${item.points}` : "0"}</StatusPill>
          </div>
        ))}
      </div>
    </details>
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

function formatFileSize(sizeBytes: number | null) {
  if (!sizeBytes) {
    return "Розмір не визначено";
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} КБ`;
  }

  return `${(sizeBytes / 1024 / 1024).toFixed(1)} МБ`;
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
  "case.scored": "Скоринг оновлено",
  "comment.created": "Коментар додано",
  "case.transferred_to_marketing": "Кейс передано в маркетинг",
};

function getScoring(caseItem: CaseRow) {
  const scoring = caseItem.metadata?.scoring;
  return scoring && typeof scoring === "object" ? (scoring as ScoringResult) : null;
}

function getScoringLabel(label: string) {
  const criterion = scoringCriteria.find((item) => item.key === label || item.fullLabel === label || item.shortLabel === label);
  return criterion?.fullLabel ?? label;
}

function getPriority(caseItem: CaseRow) {
  const priority = caseItem.metadata?.priority;
  return typeof priority === "string" ? priority : "Не визначено";
}

function getMonitoring(caseItem: CaseRow) {
  const monitoring = caseItem.metadata?.marketingMonitoring;
  return monitoring && typeof monitoring === "object" ? (monitoring as Record<string, unknown>) : {};
}

function getScoringInput(caseItem: CaseRow) {
  const scoringInput = caseItem.metadata?.scoringInput;
  return scoringInput && typeof scoringInput === "object" ? (scoringInput as Record<string, unknown>) : {};
}

function getText(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}
