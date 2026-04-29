import { google } from "googleapis";

import { env } from "@/env";
import type { SheetMapping } from "@/lib/imports/types";

export async function readGoogleSheetRows(spreadsheetId: string, sheetName: string, mapping: SheetMapping) {
  if (!env.GOOGLE_SHEETS_CLIENT_EMAIL || !env.GOOGLE_SHEETS_PRIVATE_KEY) {
    throw new Error("google_credentials_missing");
  }

  const auth = new google.auth.JWT({
    email: env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  const values = response.data.values ?? [];
  const [headers = [], ...rows] = values;
  const headerIndex = new Map(headers.map((header, index) => [String(header).trim(), index]));

  return rows.map((row, index) => ({
    index,
    googleSheetRowId: readMappedValue(row, headerIndex, mapping.rowId) || `${sheetName}:${index + 2}`,
    projectTitle: readMappedValue(row, headerIndex, mapping.projectTitle),
    clientName: readMappedValue(row, headerIndex, mapping.clientName),
    city: readMappedValue(row, headerIndex, mapping.city),
    managerEmail: readMappedValue(row, headerIndex, mapping.managerEmail).toLowerCase(),
    launchDate: readMappedValue(row, headerIndex, mapping.launchDate),
    permissionStatus: readMappedValue(row, headerIndex, mapping.permissionStatus),
    summary: readMappedValue(row, headerIndex, mapping.summary),
  }));
}

function readMappedValue(row: string[], headerIndex: Map<string, number>, headerName: string) {
  const index = headerIndex.get(headerName.trim());
  if (index === undefined) {
    return "";
  }

  return String(row[index] ?? "").trim();
}
