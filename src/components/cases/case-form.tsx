import type { ReactNode } from "react";

import { createCaseAction, updateCaseAction } from "@/app/(private)/cases/actions";
import { StageDateFields } from "@/components/cases/stage-date-fields";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
import { getPriorityTone, getToneCardClass } from "@/components/ui/status-pill";
import { getMetadataText } from "@/lib/cases/format";
import { normalizeLegacyScoringInput, scoringCriteria } from "@/lib/cases/scoring";
import { type CaseRow, type DirectoryOption, legacyStageMapping, projectStatusOptions } from "@/lib/cases/types";

type CaseFormProps = {
  mode: "create" | "edit";
  caseItem?: CaseRow;
  segments: DirectoryOption[];
  cities: DirectoryOption[];
};

const textScoringFields = ["hasClientTask", "hasSprofSolution", "hasMetricOrEffect", "hasVisualHook"] as const;
const hiddenScoringFields = [
  "hasPermissionChance",
  "hasBeforeOpportunity",
  "hasDuringOpportunity",
  "hasAfterOpportunity",
  "hasFeasibleDates",
];
const shootingAnswerOptions = ["Так", "Ні", "Не відомо"] as const;

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
  const rawStage = getMonitoringText(monitoring, "projectStage");
  const stage = legacyStageMapping[rawStage] ?? rawStage;
  const stagePlannedDate = getMonitoringText(monitoring, "stagePlannedDate") || getMonitoringText(monitoring, "keyDate");
  const permissionStatus =
    scoringInput.permissionStatus === "Так" || scoringInput.permissionStatus === "Ні"
      ? scoringInput.permissionStatus
      : scoringInput.hasPermissionChance
        ? "Так"
        : "";

  // --- CREATE MODE: minimal form ---
  if (mode === "create") {
    return (
      <form action={action} className="space-y-5">
        <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4 border-b pb-4">
            <h2 className="text-base font-semibold">Швидке створення кейсу</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Заповніть лише основне. Деталі можна додати пізніше в картці кейсу.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="text-sm font-medium">
              Назва кейсу *
              <input
                className="mt-2 h-10 w-full rounded-md border bg-background px-3"
                name="title"
                placeholder="Наприклад: запуск кухні у новому ресторані"
                required
              />
            </label>

            <label className="text-sm font-medium">
              Короткий опис *
              <textarea
                className="mt-2 min-h-20 w-full rounded-md border bg-background px-3 py-2"
                name="summary"
                placeholder="1-2 речення: хто клієнт, що робимо і чому це може бути кейсом"
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="Сегмент *" name="segmentId" required value="">
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
                  <InfoHint label="Почніть вводити місто. Можна вибрати з довідника або вписати нове." />
                </span>
                <input
                  className="mt-2 h-10 w-full rounded-md border bg-background px-3"
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
              <SelectField label="Статус *" name="projectStatus" required value="Новий">
                {projectStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </section>

        {/* Hidden defaults for scoring — so buildCaseMetadata doesn't break */}
        <input name="hasPermissionChance" type="hidden" value="true" />
        <input name="shootingBefore" type="hidden" value="Не відомо" />
        <input name="shootingDuring" type="hidden" value="Не відомо" />
        <input name="shootingAfter" type="hidden" value="Не відомо" />

        <Button type="submit">Додати кейс</Button>
      </form>
    );
  }

  // --- EDIT MODE: accordion sections with progress ---
  const filledFields = countFilledFields(scoringInput, monitoring, metadata);
  const totalFields = 10;
  const progressPercent = Math.round((filledFields / totalFields) * 100);

  return (
    <form action={action} className="space-y-5">
      {caseItem ? <input name="caseId" type="hidden" value={caseItem.id} /> : null}

      {/* Progress bar */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Готовність до маркетингу</span>
          <span className="text-muted-foreground">{filledFields}/{totalFields} полів</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Section 1: Object basics — always open */}
      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Обʼєкт</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Назва, опис, місто, сегмент і статус.
            </p>
          </div>
          <div className={`w-full rounded-md border px-3 py-2 md:w-52 ${getToneCardClass(getPriorityTone(priority))}`}>
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
              placeholder="1-2 речення: хто клієнт, що робимо і чому це може бути кейсом"
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

      {/* Section 2: Project stage — collapsible */}
      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <details className="group" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Стадія проєкту</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Етап, оплата і планова дата.
              </p>
            </div>
            <span className="text-sm font-medium text-primary group-open:hidden">Показати</span>
            <span className="hidden text-sm font-medium text-primary group-open:inline">Сховати</span>
          </summary>
          <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              <span className="flex items-center gap-2">
                Оплата / передоплата
                <InfoHint label="Позначте, чи є передоплата, повна оплата або ще немає підтвердження." />
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
                hint="Якщо це відомий або популярний обʼєкт - ставимо так, якщо ні - ні."
                label="Відомий обʼєкт"
                name="isHighProfile"
              />
              <CheckRow
                defaultChecked={Boolean(monitoring.bigCheck)}
                hint="Дорогий обʼєкт: багато позицій у замовленні або проєкт на велику суму."
                label="Дорогий обʼєкт"
                name="bigCheck"
              />
            </div>
          </div>
        </details>
      </section>

      {/* Section 3: Shooting — collapsible */}
      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Зйомка</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Дозвіл, що показати і вікна для зйомки.
              </p>
            </div>
            <span className="text-sm font-medium text-primary group-open:hidden">Показати</span>
            <span className="hidden text-sm font-medium text-primary group-open:inline">Сховати</span>
          </summary>
          <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
            <PermissionField
              comment={scoringInput.permissionComment ?? getMonitoringText(monitoring, "permissionComment")}
              value={permissionStatus}
            />
            <ScoreToggle
              defaultChecked={Boolean(scoringInput.hasVisualShowcase)}
              description="Є що показати: кухня, зона, процес, монтаж або навчання. Вага: +2 балів."
              label="Є що показати"
              name="hasVisualShowcase"
            />
            <ShootingWindowBlock monitoring={monitoring} scoringInput={scoringInput} />
          </div>
        </details>
      </section>

      {/* Section 4: Marketing facts — collapsible */}
      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Факти для маркетингу</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Задача, рішення, результат, особливість — для контенту.
              </p>
            </div>
            <span className="text-sm font-medium text-primary group-open:hidden">Показати</span>
            <span className="hidden text-sm font-medium text-primary group-open:inline">Сховати</span>
          </summary>
          <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
            {scoringCriteria
              .filter((criterion) => !hiddenScoringFields.includes(criterion.key) && criterion.key !== "hasVisualShowcase")
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
        </details>
      </section>

      {/* Section 5: Contacts — collapsible, closed by default */}
      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Контактна особа та додаткові відомості</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Контакти, джерело і службові нотатки.
              </p>
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
          Запропонувати маркетингу цей обʼєкт як кейс можна окремою кнопкою у правому блоці картки.
        </p>
      ) : null}

      <Button type="submit">Зберегти зміни</Button>
    </form>
  );
}

// --- Helper: count filled scoring/marketing fields ---
function countFilledFields(
  scoringInput: Record<string, unknown>,
  monitoring: Record<string, unknown>,
  metadata: Record<string, unknown>,
) {
  let count = 0;
  if (scoringInput.hasPermissionChance) count++;
  if (scoringInput.hasVisualShowcase) count++;
  if (typeof scoringInput.hasClientTask === "string" && scoringInput.hasClientTask) count++;
  if (typeof scoringInput.hasSprofSolution === "string" && scoringInput.hasSprofSolution) count++;
  if (typeof scoringInput.hasMetricOrEffect === "string" && scoringInput.hasMetricOrEffect) count++;
  if (typeof scoringInput.hasVisualHook === "string" && scoringInput.hasVisualHook) count++;
  if (monitoring.projectStage) count++;
  if (monitoring.stagePlannedDate || monitoring.keyDate) count++;
  if (typeof metadata.contactName === "string" && metadata.contactName) count++;
  if (typeof metadata.source === "string" && metadata.source) count++;
  return count;
}

function PermissionField({ comment, value }: { comment: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3 md:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">Дозвіл на зйомку</span>
        <InfoHint label="Якщо обрано «Ні», кейс не набирає бали. Обовʼязково поясніть, чому власник не дозволив або чому цей обʼєкт не можна зняти." />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span>Так</span>
          <input className="size-4" defaultChecked={value === "Так"} name="hasPermissionChance" required type="radio" value="true" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span>Ні</span>
          <input className="size-4" defaultChecked={value === "Ні"} name="hasPermissionChance" required type="radio" value="false" />
        </label>
      </div>
      <label className="mt-3 block text-sm font-medium">
        Коментар, якщо знімати не можна
        <textarea
          className="mt-2 min-h-20 w-full rounded-md border bg-muted/20 px-3 py-2 text-sm font-normal"
          defaultValue={comment}
          name="permissionComment"
          placeholder="Наприклад: власник проти зйомки гостей, закрита зона виробництва або немає доступу на обʼєкт."
        />
      </label>
    </div>
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
        <span>Позначити &ldquo;Так&rdquo;</span>
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

function ShootingWindowBlock({
  monitoring,
  scoringInput,
}: {
  monitoring: Record<string, unknown>;
  scoringInput: Record<string, unknown>;
}) {
  const shootingWindows = getObject(monitoring.shootingWindows);

  return (
    <div className="rounded-md border bg-background p-3 md:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">Коли можна знімати</span>
        <InfoHint label="Позначте, чи можна зняти обʼєкт до початку робіт, під час монтажу і після монтажу. Якщо поки незрозуміло - оберіть «Не відомо»." />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ShootingWindowSelect
          label="До початку"
          name="shootingBefore"
          value={getShootingAnswer(shootingWindows, "before", scoringInput.hasBeforeOpportunity)}
        />
        <ShootingWindowSelect
          label="Під час монтажу"
          name="shootingDuring"
          value={getShootingAnswer(shootingWindows, "during", scoringInput.hasDuringOpportunity)}
        />
        <ShootingWindowSelect
          label="Після монтажу"
          name="shootingAfter"
          value={getShootingAnswer(shootingWindows, "after", scoringInput.hasAfterOpportunity)}
        />
      </div>
    </div>
  );
}

function ShootingWindowSelect({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select className="mt-2 h-10 w-full rounded-md border bg-muted/20 px-3" defaultValue={value} name={name}>
        {shootingAnswerOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
  children: ReactNode;
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

function getObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getMonitoringText(monitoring: Record<string, unknown>, key: string) {
  const value = monitoring[key];
  return typeof value === "string" ? value : "";
}

function getScoringText(scoringInput: Record<string, unknown>, key: string) {
  const value = scoringInput[key];
  return typeof value === "string" ? value : "";
}

function getShootingAnswer(source: Record<string, unknown>, key: string, legacyValue: unknown) {
  const value = source[key];

  if (value === "Так" || value === "Ні" || value === "Не відомо") {
    return value;
  }

  return legacyValue === true ? "Так" : "Не відомо";
}

function isTextScoringField(key: string): key is (typeof textScoringFields)[number] {
  return textScoringFields.includes(key as (typeof textScoringFields)[number]);
}
