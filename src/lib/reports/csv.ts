import type { CaseRow } from "../cases/types";

import { getLaunchDate, getPermission, getPriority } from "./summary";

export function buildCasesCsv(cases: CaseRow[]) {
  const headers = [
    "Назва",
    "Менеджер",
    "Місто",
    "Пріоритет",
    "Оцінка",
    "Статус маркетингу",
    "Дата монтажу/запуску",
    "Дозвіл",
    "Оновлено",
  ];

  const rows = cases.map((caseItem) => [
    caseItem.title,
    caseItem.owner?.display_name ?? caseItem.owner?.email ?? "",
    caseItem.cities?.name ?? "",
    getPriority(caseItem),
    String(caseItem.score ?? 0),
    caseItem.marketing_status ?? "",
    getLaunchDate(caseItem),
    getPermission(caseItem),
    caseItem.updated_at,
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value: string) {
  const normalized = neutralizeSpreadsheetFormula(value);
  const escaped = normalized.replaceAll('"', '""');
  return `"${escaped}"`;
}

function neutralizeSpreadsheetFormula(value: string) {
  const trimmed = value.trimStart();

  if (!trimmed) {
    return value;
  }

  return /^[=+\-@\t\r\n]/.test(trimmed) ? `'${value}` : value;
}
