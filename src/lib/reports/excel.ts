import ExcelJS from "exceljs";
import type { CaseRow } from "../cases/types";
import { getProjectStage } from "@/lib/cases/helpers";
import { getLaunchDate, getPermission, getPriority } from "./summary";

export async function buildCasesExcel(cases: CaseRow[]) {
  const headers = [
    "Назва",
    "Опис",
    "Місто",
    "Сегмент",
    "Менеджер",
    "Статус",
    "Пріоритет",
    "Бал",
    "Стадія",
    "Дозвіл на зйомку",
    "Статус маркетингу",
    "Планова дата",
    "Дата створення",
    "Дата оновлення",
  ];

  const rows = cases.map((caseItem) => [
    caseItem.title,
    caseItem.summary ?? "",
    caseItem.cities?.name ?? "",
    caseItem.case_segments?.name ?? "",
    caseItem.owner?.display_name ?? caseItem.owner?.email ?? "",
    caseItem.project_status ?? "",
    getPriority(caseItem),
    caseItem.score ?? 0,
    getProjectStage(caseItem),
    getPermission(caseItem),
    caseItem.marketing_status ?? "",
    getLaunchDate(caseItem),
    new Date(caseItem.created_at).toLocaleString("uk-UA"),
    new Date(caseItem.updated_at).toLocaleString("uk-UA"),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Радар кейсів SPROF";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Кейси");
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // Auto-size columns slightly
  const widths = headers.map((header) => Math.max(header.length, 14));
  widths[0] = 36;
  widths[1] = 48;
  widths[4] = 24;
  worksheet.columns.forEach((column, index) => {
    column.width = widths[index];
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
