"use client";

import { useMemo, useState } from "react";

import { InfoHint } from "@/components/ui/info-hint";
import { projectStageOptions } from "@/lib/cases/types";

type StageDateFieldsProps = {
  defaultDate?: string;
  defaultStage?: string;
};

export function StageDateFields({ defaultDate = "", defaultStage = "" }: StageDateFieldsProps) {
  const [stage, setStage] = useState(defaultStage);
  const label = useMemo(() => (stage ? `Планована дата: ${stage}` : "Планована дата стадії"), [stage]);

  return (
    <>
      <label className="text-sm font-medium">
        <span className="flex items-center gap-2">
          Стадія проєкту
          <InfoHint label="Менеджер оновлює стадію, коли проєкт переходить на наступний етап. Якщо стадія довго не змінюється, система нагадає перевірити кейс." />
        </span>
        <select
          className="mt-2 h-10 w-full rounded-md border bg-background px-3"
          defaultValue={defaultStage}
          name="projectStage"
          onChange={(event) => setStage(event.target.value)}
        >
          <option value="">Не вказано</option>
          {projectStageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {stage ? (
        <label className="text-sm font-medium">
          <span className="flex items-center gap-2">
            {label}
            <InfoHint label="Дата вводиться вручну. Вона допомагає зрозуміти, коли маркетинг може встигнути на зйомку." />
          </span>
          <input
            className="mt-2 h-10 w-full rounded-md border bg-background px-3"
            defaultValue={defaultDate}
            name="stagePlannedDate"
            type="date"
          />
        </label>
      ) : (
        <input name="stagePlannedDate" type="hidden" value="" />
      )}
    </>
  );
}
