import { createCaseAction, updateCaseAction } from "@/app/(private)/cases/actions";
import { StageDateFields } from "@/components/cases/stage-date-fields";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { getMetadataText } from "@/lib/cases/format";
import { normalizeLegacyScoringInput, scoringCriteria } from "@/lib/cases/scoring";
import {
  type CaseRow,
  type DirectoryOption,
  marketingStatusOptions,
  projectStatusOptions,
} from "@/lib/cases/types";

type CaseFormProps = {
  mode: "create" | "edit";
  caseItem?: CaseRow;
  segments: DirectoryOption[];
  cities: DirectoryOption[];
};

const textScoringFields = ["hasClientTask", "hasSprofSolution", "hasMetricOrEffect", "hasVisualHook"] as const;
const hiddenScoringFields = ["hasFeasibleDates"];

export function CaseForm({ mode, caseItem, segments, cities }: CaseFormProps) {
  const action = mode === "create" ? createCaseAction : updateCaseAction;
  const metadata = caseItem?.metadata ?? {};
  const scoringInput =
    metadata.scoringInput && typeof metadata.scoringInput === "object"
      ? normalizeLegacyScoringInput(metadata.scoringInput as Record<string, unknown>)
      : {};
  const monitoring =
    metadata.marketingMonitoring && typeof metadata.marketingMonitoring === "object"
      ? (metadata.marketingMonitoring as Record<string, unknown>)
      : {};
  const score = caseItem?.score ?? 0;
  const priority = typeof metadata.priority === "string" ? metadata.priority : "Спостерігаємо";
  const stage = getMonitoringText(monitoring, "projectStage");
  const stagePlannedDate = getMonitoringText(monitoring, "stagePlannedDate") || getMonitoringText(monitoring, "keyDate");

  return (
    <form action={action} className="space-y-5">
      {caseItem ? <input name="caseId" type="hidden" value={caseItem.id} /> : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Основа кейсу</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Обовʼязкові поля: назва, опис, сегмент, місто і статус. Місто можна вибрати або вписати вручну.
            </p>
          </div>
          <div className="w-full rounded-md border bg-muted/40 px-3 py-2 md:w-52">
            <p className="text-xs font-medium uppercase text-muted-foreground">Оцінка</p>
            <p className="mt-1 text-xl font-semibold">{score} балів</p>
            <p className="text-xs text-muted-foreground">{priority}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <label className="text-sm font-medium">
            Назва кейсу *
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={caseItem?.title}
              name="title"
              placeholder="Наприклад: запуск кухні у новому ресторані"
              required
            />
          </label>

          <label className="text-sm font-medium">
            Короткий опис *
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2"
              defaultValue={caseItem?.summary ?? ""}
              name="summary"
              placeholder="1-2 речення: що за клієнт, що робимо, чому це може бути кейсом"
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <SelectField label="Сегмент *" name="segmentId" required value={caseItem?.segment_id ?? ""}>
              <option value="">Не вибрано</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </SelectField>
            <label className="text-sm font-medium">
              <span className="flex items-center gap-2">
                Місто *
                <InfoHint label="Почніть вводити місто. Можна вибрати з довідника або вписати нове, воно створиться автоматично." />
              </span>
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                defaultValue={caseItem?.cities?.name ?? ""}
                list="city-options"
                name="cityName"
                placeholder="Київ або нове місто"
                required
              />
              <datalist id="city-options">
                {cities.map((city) => (
                  <option key={city.id} value={city.name} />
                ))}
              </datalist>
            </label>
            <SelectField label="Статус *" name="projectStatus" required value={caseItem?.project_status ?? "Новий"}>
              {projectStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 border-b pb-4">
          <h2 className="text-base font-semibold">Стадія і маркетинговий момент</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Оплата за обладнання стоїть першою. Але кейс може бути цікавим ще до монтажу, якщо можна зняти “до”, “під час” і “після”.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            <span className="flex items-center gap-2">
              Оплата / передоплата
              <InfoHint label="Позначає, чи є передоплата, повна оплата або ще немає підтвердження." />
            </span>
            <select
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={getMonitoringText(monitoring, "paymentStatus")}
              name="paymentStatus"
            >
              <option value="">Не вказано</option>
              <option value="Передоплата">Передоплата</option>
              <option value="Оплата">Оплата</option>
              <option value="Немає">Немає</option>
            </select>
          </label>
          <StageDateFields defaultDate={stagePlannedDate} defaultStage={stage} />
          <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
            <CheckRow
              defaultChecked={Boolean(monitoring.equipmentApproved)}
              hint="Комплектація погоджена клієнтом або внутрішньо затверджена."
              label="Комплектація затверджена"
              name="equipmentApproved"
            />
            <CheckRow
              defaultChecked={Boolean(monitoring.isHighProfile)}
              hint="Відомий заклад, мережа, держобʼєкт або кейс, який може бути гучним для ринку."
              label="Гучний обʼєкт"
              name="isHighProfile"
            />
            <CheckRow
              defaultChecked={Boolean(monitoring.bigCheck)}
              hint="Великий чек або стратегічно важливий проєкт."
              label="Великий чек"
              name="bigCheck"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 border-b pb-4">
          <h2 className="text-base font-semibold">Чи це кандидат на зйомку?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Текстові поля дають бали тільки тоді, коли менеджер справді описав фактуру. Короткі пункти мають пояснення поруч.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {scoringCriteria
            .filter((criterion) => !hiddenScoringFields.includes(criterion.key))
            .map((criterion) =>
              isTextScoringField(criterion.key) ? (
                <ScoreTextField
                  defaultValue={getScoringText(scoringInput, criterion.key)}
                  description={`${criterion.fullLabel}. Вага: +${criterion.points} балів.`}
                  key={criterion.key}
                  label={criterion.shortLabel}
                  name={criterion.key}
                />
              ) : (
                <ScoreToggle
                  defaultChecked={Boolean(scoringInput[criterion.key])}
                  description={`${criterion.fullLabel}. Вага: +${criterion.points} балів.`}
                  key={criterion.key}
                  label={criterion.shortLabel}
                  name={criterion.key}
                />
              ),
            )}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <details className="group" open={mode === "edit"}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Додатково</h2>
              <p className="mt-1 text-sm text-muted-foreground">Контакти, джерело і службові нотатки. Можна заповнити пізніше.</p>
            </div>
            <span className="text-sm font-medium text-primary group-open:hidden">Показати</span>
            <span className="hidden text-sm font-medium text-primary group-open:inline">Сховати</span>
          </summary>
          <div className="mt-4 grid gap-4 border-t pt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Контакт" name="contactName" value={getMetadataText(metadata, "contactName")} />
              <TextField label="Телефон / месенджер" name="contactPhone" value={getMetadataText(metadata, "contactPhone")} />
              <TextField label="Джерело" name="source" value={getMetadataText(metadata, "source")} />
              <TextField label="Цінність" name="expectedValue" value={getMetadataText(metadata, "expectedValue")} />
            </div>
            <label className="text-sm font-medium">
              Нотатки
              <textarea
                className="mt-2 min-h-20 w-full rounded-md border bg-background px-3 py-2"
                defaultValue={getMetadataText(metadata, "notes")}
                name="notes"
              />
            </label>
          </div>
        </details>
      </section>

      {caseItem?.marketing_status ? (
        <p className="text-sm text-muted-foreground">
          Поточний статус маркетингу: <span className="font-medium text-foreground">{caseItem.marketing_status}</span>
        </p>
      ) : null}
      <input name="marketingStatus" type="hidden" value={caseItem?.marketing_status ?? marketingStatusOptions[0]} />

      <Button type="submit">{mode === "create" ? "Додати кейс" : "Зберегти зміни"}</Button>
    </form>
  );
}

function ScoreToggle({
  defaultChecked,
  description,
  label,
  name,
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          <InfoHint label={description} />
        </div>
        <span className="text-xs text-muted-foreground">Так / Ні</span>
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <span>Позначити “Так”</span>
        <input className="size-4" defaultChecked={defaultChecked} name={name} type="checkbox" />
      </label>
    </div>
  );
}

function ScoreTextField({
  defaultValue,
  description,
  label,
  name,
}: {
  defaultValue: string;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="rounded-md border bg-background p-3 text-sm font-medium">
      <span className="flex items-center gap-2">
        {label}
        <InfoHint label={description} />
      </span>
      <textarea
        className="mt-3 min-h-24 w-full rounded-md border bg-muted/20 px-3 py-2 text-sm font-normal"
        defaultValue={defaultValue}
        name={name}
        placeholder="Коротко опишіть факт, який зможе використати маркетинг"
      />
    </label>
  );
}

function CheckRow({
  defaultChecked,
  hint,
  label,
  name,
}: {
  defaultChecked: boolean;
  hint: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border bg-background px-3 text-sm font-medium">
      <span className="flex items-center gap-2">
        {label}
        <InfoHint label={hint} />
      </span>
      <input className="size-4" defaultChecked={defaultChecked} name={name} type="checkbox" />
    </label>
  );
}

function TextField({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={value} name={name} />
    </label>
  );
}

function SelectField({
  children,
  hint,
  label,
  name,
  required,
  value,
}: {
  children: React.ReactNode;
  hint?: string;
  label: string;
  name: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="text-sm font-medium">
      <span className="flex items-center gap-2">
        {label}
        {hint ? <InfoHint label={hint} /> : null}
      </span>
      <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={value} name={name} required={required}>
        {children}
      </select>
    </label>
  );
}

function getMonitoringText(monitoring: Record<string, unknown>, key: string) {
  const value = monitoring[key];
  return typeof value === "string" ? value : "";
}

function getScoringText(scoringInput: Record<string, unknown>, key: string) {
  const value = scoringInput[key];
  return typeof value === "string" ? value : "";
}

function isTextScoringField(key: string): key is (typeof textScoringFields)[number] {
  return textScoringFields.includes(key as (typeof textScoringFields)[number]);
}
