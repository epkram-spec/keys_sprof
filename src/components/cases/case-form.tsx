import { createCaseAction, updateCaseAction } from "@/app/(private)/cases/actions";
import { Button } from "@/components/ui/button";
import { getMetadataText } from "@/lib/cases/format";
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

export function CaseForm({ mode, caseItem, segments, cities }: CaseFormProps) {
  const action = mode === "create" ? createCaseAction : updateCaseAction;
  const metadata = caseItem?.metadata ?? {};
  const scoringInput =
    metadata.scoringInput && typeof metadata.scoringInput === "object"
      ? (metadata.scoringInput as Record<string, unknown>)
      : {};

  return (
    <form action={action} className="space-y-5">
      {caseItem ? <input name="caseId" type="hidden" value={caseItem.id} /> : null}

      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <label className="text-sm font-medium">
            Назва кейсу *
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={caseItem?.title}
              name="title"
              required
            />
          </label>
          <div className="rounded-md border bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Автоматична оцінка</p>
            <p className="mt-1 text-lg font-semibold">
              {caseItem?.score ?? 0} балів
            </p>
            <p className="text-xs text-muted-foreground">Менеджер не редагує оцінку вручну.</p>
          </div>
        </div>

        <label className="text-sm font-medium">
          Короткий опис *
          <textarea
            className="mt-2 min-h-28 w-full rounded-md border bg-background px-3 py-2"
            defaultValue={caseItem?.summary ?? ""}
            name="summary"
            required
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium">
            Сегмент
            <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={caseItem?.segment_id ?? ""} name="segmentId">
              <option value="">Не вибрано</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Місто
            <select className="mt-2 h-10 w-full rounded-md border bg-background px-3" defaultValue={caseItem?.city_id ?? ""} name="cityId">
              <option value="">Не вибрано</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Статус кейсу
            <select
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={caseItem?.project_status ?? "Новий"}
              name="projectStatus"
            >
              {projectStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Додатково</h2>
          <p className="mt-1 text-sm text-muted-foreground">Необовʼязкові поля для контексту майбутнього кейсу.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Контактна особа
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={getMetadataText(metadata, "contactName")}
              name="contactName"
            />
          </label>
          <label className="text-sm font-medium">
            Телефон або месенджер
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={getMetadataText(metadata, "contactPhone")}
              name="contactPhone"
            />
          </label>
          <label className="text-sm font-medium">
            Джерело
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={getMetadataText(metadata, "source")}
              name="source"
            />
          </label>
          <label className="text-sm font-medium">
            Орієнтовна цінність
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={getMetadataText(metadata, "expectedValue")}
              name="expectedValue"
            />
          </label>
        </div>
        <label className="text-sm font-medium">
          Нотатки
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border bg-background px-3 py-2"
            defaultValue={getMetadataText(metadata, "notes")}
            name="notes"
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Скоринг</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Позначте факти, а система сама порахує бали й пріоритет.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Дата монтажу або запуску
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={typeof scoringInput.launchDate === "string" ? scoringInput.launchDate : ""}
              name="launchDate"
              type="date"
            />
          </label>
          <label className="text-sm font-medium">
            Дозвіл на використання кейсу
            <select
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={typeof scoringInput.permissionStatus === "string" ? scoringInput.permissionStatus : ""}
              name="permissionStatus"
            >
              <option value="">Не вказано</option>
              <option value="Так">Так</option>
              <option value="Уточнюється">Уточнюється</option>
              <option value="Ні">Ні</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ScoreCheckbox
            defaultChecked={Boolean(scoringInput.hasShowcase)}
            label="Є що показати"
            name="hasShowcase"
          />
          <ScoreCheckbox
            defaultChecked={Boolean(scoringInput.isRecognizableClient)}
            label="Впізнаваний клієнт"
            name="isRecognizableClient"
          />
          <ScoreCheckbox
            defaultChecked={Boolean(scoringInput.isComplexProject)}
            label="Комплексний проєкт"
            name="isComplexProject"
          />
          <ScoreCheckbox
            defaultChecked={Boolean(scoringInput.hasMetricOrEffect)}
            label="Є цифра або ефект"
            name="hasMetricOrEffect"
          />
          <ScoreCheckbox
            defaultChecked={Boolean(scoringInput.hasCommentPerson)}
            label="Є людина для коментаря"
            name="hasCommentPerson"
          />
          <ScoreCheckbox
            defaultChecked={Boolean(scoringInput.hasPhotoOrVideo)}
            label="Є фото або відео"
            name="hasPhotoOrVideo"
          />
        </div>
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

function ScoreCheckbox({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-md border bg-background px-3 text-sm font-medium">
      <input className="size-4" defaultChecked={defaultChecked} name={name} type="checkbox" />
      {label}
    </label>
  );
}
