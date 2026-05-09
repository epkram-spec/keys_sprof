import { createSourceAndPreviewAction, confirmImportAction, previewExistingSourceAction } from "@/app/(private)/imports/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/cases/format";
import { defaultSheetMapping, type PreviewRow } from "@/lib/imports/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ImportsPageProps = {
  searchParams: Promise<{
    import_id?: string;
    error?: string;
    success?: string;
  }>;
};

type SourceRow = {
  id: string;
  name: string;
  spreadsheet_id: string;
  sheet_name: string | null;
  created_at: string;
};

type ImportRun = {
  id: string;
  status: string;
  rows_total: number;
  rows_created: number;
  rows_failed: number;
  started_at: string;
  finished_at: string | null;
  metadata: {
    previewRows?: PreviewRow[];
  };
};

const successMessages: Record<string, string> = {
  preview_ready: "Preview готовий. Перевірте рядки й підтвердьте імпорт.",
  import_completed: "Імпорт завершено.",
};

const errorMessages: Record<string, string> = {
  forbidden: "Імпорт доступний тільки адміністратору.",
  source_required: "Заповніть назву джерела, spreadsheet ID і назву листа.",
  source_create: "Не вдалося створити джерело.",
  source_not_found: "Джерело не знайдено.",
  preview_save: "Не вдалося зберегти preview.",
  preview_failed: "Не вдалося прочитати Google Sheets. Перевірте доступ service account.",
  no_rows_selected: "Оберіть хоча б один новий рядок для імпорту.",
};

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: sources }, { data: imports }, { data: selectedImport }] = await Promise.all([
    supabase
      .from("google_sheet_sources")
      .select("id,name,spreadsheet_id,sheet_name,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("google_sheet_imports")
      .select("id,status,rows_total,rows_created,rows_failed,started_at,finished_at,metadata")
      .order("started_at", { ascending: false })
      .limit(10),
    params.import_id
      ? supabase
          .from("google_sheet_imports")
          .select("id,status,rows_total,rows_created,rows_failed,started_at,finished_at,metadata")
          .eq("id", params.import_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const previewRows = ((selectedImport as ImportRun | null)?.metadata.previewRows ?? []) as PreviewRow[];

  return (
    <>
      <PageHeader
        title="Імпорт"
        description="Контрольований імпорт із Google Sheets: preview, перевірка дублів і ручне підтвердження."
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

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Джерело Google Sheets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Таблиця читається тільки в один бік. Ручні зміни в кейсах не перетираються.
          </p>
          <form action={createSourceAndPreviewAction} className="mt-5 space-y-4">
            <TextInput label="Назва джерела" name="name" placeholder="Кейси з таблиці продажів" />
            <TextInput label="Spreadsheet ID" name="spreadsheetId" placeholder="1abc..." />
            <TextInput label="Назва листа" name="sheetName" placeholder="Аркуш1" />

            <div className="rounded-md border bg-background p-3">
              <h3 className="font-semibold">Mapping колонок</h3>
              <div className="mt-3 grid gap-3">
                {Object.entries(defaultSheetMapping).map(([key, value]) => (
                  <TextInput key={key} label={mappingLabels[key] ?? key} name={key} placeholder={value} />
                ))}
              </div>
            </div>

            <Button type="submit">Створити джерело і preview</Button>
          </form>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Наявні джерела</h2>
          <div className="mt-4 space-y-3">
            {((sources ?? []) as SourceRow[]).length ? (
              ((sources ?? []) as SourceRow[]).map((source) => (
                <form action={previewExistingSourceAction} className="rounded-md border bg-background p-3" key={source.id}>
                  <input name="sourceId" type="hidden" value={source.id} />
                  <p className="font-medium">{source.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {source.sheet_name ?? "Без назви листа"} · створено {formatDateTime(source.created_at)}
                  </p>
                  <Button className="mt-3" size="sm" type="submit" variant="secondary">
                    Оновити preview
                  </Button>
                </form>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Джерел ще немає.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Preview рядків</h2>
        {previewRows.length ? (
          <form action={confirmImportAction} className="mt-4">
            <input name="importId" type="hidden" value={(selectedImport as ImportRun | null)?.id ?? ""} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Імпорт</th>
                    <th className="py-2 pr-3">Статус</th>
                    <th className="py-2 pr-3">Проєкт</th>
                    <th className="py-2 pr-3">Клієнт</th>
                    <th className="py-2 pr-3">Місто</th>
                    <th className="py-2 pr-3">Менеджер</th>
                    <th className="py-2 pr-3">Дата</th>
                    <th className="py-2 pr-3">Повідомлення</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr className="border-b last:border-b-0" key={`${row.googleSheetRowId}-${row.index}`}>
                      <td className="py-2 pr-3">
                        <input
                          disabled={row.status !== "новий" && row.status !== "готовий до оновлення"}
                          name="rowIndex"
                          type="checkbox"
                          value={row.index}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-2 pr-3 font-medium">{row.projectTitle || "Без назви"}</td>
                      <td className="py-2 pr-3">{row.clientName || "Не вказано"}</td>
                      <td className="py-2 pr-3">{row.city || "Не вказано"}</td>
                      <td className="py-2 pr-3">{row.managerEmail || "Не вказано"}</td>
                      <td className="py-2 pr-3">{row.launchDate || "Не вказано"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button className="mt-4" type="submit">
              Підтвердити вибрані рядки
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Створіть або оновіть preview, щоб побачити рядки.</p>
        )}
      </section>

      <section className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Журнал імпорту</h2>
        <div className="mt-4 space-y-3">
          {((imports ?? []) as ImportRun[]).length ? (
            ((imports ?? []) as ImportRun[]).map((item) => (
              <div className="rounded-md border bg-background p-3" key={item.id}>
                <p className="font-medium">Статус: {translateImportStatus(item.status)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Рядків: {item.rows_total}, створено: {item.rows_created}, помилок: {item.rows_failed}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Початок: {formatDateTime(item.started_at)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Запусків імпорту ще немає.</p>
          )}
        </div>
      </section>
    </>
  );
}

function TextInput({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" name={name} placeholder={placeholder} />
    </label>
  );
}

function StatusBadge({ status }: { status: PreviewRow["status"] }) {
  let color = "bg-background text-foreground";
  if (status === "новий") color = "bg-primary/10 text-primary border-primary/20";
  if (status === "готовий до оновлення") color = "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (status === "помилка") color = "bg-destructive/10 text-destructive border-destructive/20";
  if (status === "вже імпортовано" || status === "можливий дубль") color = "bg-muted text-muted-foreground";

  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${color}`}>{status}</span>;
}

function translateImportStatus(status: string) {
  const statuses: Record<string, string> = {
    pending: "Очікує підтвердження",
    running: "Виконується",
    completed: "Завершено",
    failed: "Є помилки",
  };

  return statuses[status] ?? status;
}

const mappingLabels: Record<string, string> = {
  projectTitle: "Колонка назви проєкту",
  clientName: "Колонка клієнта",
  city: "Колонка міста",
  managerEmail: "Колонка email менеджера",
  launchDate: "Колонка дати монтажу/запуску",
  permissionStatus: "Колонка дозволу на зйомку",
  summary: "Колонка опису",
  rowId: "Колонка ID рядка",
};
