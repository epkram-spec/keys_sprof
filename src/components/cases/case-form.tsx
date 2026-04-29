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
          <label className="text-sm font-medium">
            Оцінка
            <input
              className="mt-2 h-10 w-full rounded-md border bg-background px-3"
              defaultValue={caseItem?.score ?? ""}
              max={100}
              min={0}
              name="score"
              type="number"
            />
          </label>
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
