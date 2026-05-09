import Link from "next/link";
import { notFound } from "next/navigation";

import { addCommentAction, transferToMarketingAction, uploadCaseFileAction } from "@/app/(private)/cases/actions";
import { CaseForm } from "@/components/cases/case-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/cases/format";
import type { CaseFileRow } from "@/lib/cases/files";
import { type CaseActivity, type CaseComment, type CaseRow, type DirectoryOption } from "@/lib/cases/types";
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
  created: "Кейс додано. Доповніть деталі нижче.",
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

const activityLabels: Record<string, string> = {
  "case.created": "Кейс створено",
  "case.updated": "Кейс оновлено",
  "case.scored": "Скоринг оновлено",
  "comment.created": "Коментар додано",
  "case.transferred_to_marketing": "Кейс передано в маркетинг",
  "marketing.status_changed": "Маркетолог змінив статус",
  "file.uploaded": "Файл додано",
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

function FilesPanel({ caseId, files }: { caseId: string; files: CaseFileRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Файли і фото</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Дозволено: jpg, png, webp, pdf, mp4, mov. Файли не мають відкритих публічних URL.
      </p>
      <form action={uploadCaseFileAction} className="mt-4 space-y-3">
        <input name="caseId" type="hidden" value={caseId} />
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed bg-background px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
          <svg className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
          <span>Обрати файл для завантаження</span>
          <input
            accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov,image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime"
            className="sr-only"
            name="file"
            required
            type="file"
          />
        </label>
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
  const isInMarketing = Boolean(marketingStatus && marketingStatus !== "Новий");

  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Передача в маркетинг</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Кнопка встановлює статус маркетингу «Перевірити» і записує дію в журнал.
      </p>
      <form action={transferToMarketingAction} className="mt-4">
        <input name="caseId" type="hidden" value={caseId} />
        <Button className="w-full" disabled={isInMarketing} type="submit">
          {isInMarketing ? "Уже в роботі маркетингу" : "Передати в маркетинг"}
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
