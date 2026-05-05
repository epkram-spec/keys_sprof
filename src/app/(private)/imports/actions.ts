"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AppRole } from "@/lib/auth/types";
import { calculateCaseScore } from "@/lib/cases/scoring";
import { readGoogleSheetRows } from "@/lib/imports/google-sheets";
import { defaultSheetMapping, type PreviewRow, type SheetMapping } from "@/lib/imports/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: AppRole; is_active: boolean }>();

  if (!profile?.is_active || profile.role !== "admin") {
    redirect("/imports?error=forbidden");
  }

  return { supabase, user };
}

function readMapping(formData: FormData): SheetMapping {
  return {
    projectTitle: readText(formData, "projectTitle") || defaultSheetMapping.projectTitle,
    clientName: readText(formData, "clientName") || defaultSheetMapping.clientName,
    city: readText(formData, "city") || defaultSheetMapping.city,
    managerEmail: readText(formData, "managerEmail") || defaultSheetMapping.managerEmail,
    launchDate: readText(formData, "launchDate") || defaultSheetMapping.launchDate,
    permissionStatus: readText(formData, "permissionStatus") || defaultSheetMapping.permissionStatus,
    summary: readText(formData, "summary") || defaultSheetMapping.summary,
    rowId: readText(formData, "rowId") || defaultSheetMapping.rowId,
  };
}

export async function createSourceAndPreviewAction(formData: FormData) {
  const { supabase, user } = await getAdminContext();
  const name = readText(formData, "name");
  const spreadsheetId = readText(formData, "spreadsheetId");
  const sheetName = readText(formData, "sheetName");
  const mapping = readMapping(formData);

  if (!name || !spreadsheetId || !sheetName) {
    redirect("/imports?error=source_required");
  }

  const { data: source, error: sourceError } = await supabase
    .from("google_sheet_sources")
    .insert({
      name,
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName,
      created_by_user_id: user.id,
      mapping,
    })
    .select("id")
    .single();

  if (sourceError || !source) {
    redirect("/imports?error=source_create");
  }

  await buildPreview(source.id, spreadsheetId, sheetName, mapping);
}

export async function previewExistingSourceAction(formData: FormData) {
  const { supabase } = await getAdminContext();
  const sourceId = readText(formData, "sourceId");

  const { data: source } = await supabase
    .from("google_sheet_sources")
    .select("id,spreadsheet_id,sheet_name,mapping")
    .eq("id", sourceId)
    .single<{ id: string; spreadsheet_id: string; sheet_name: string | null; mapping: SheetMapping }>();

  if (!source?.sheet_name) {
    redirect("/imports?error=source_not_found");
  }

  await buildPreview(source.id, source.spreadsheet_id, source.sheet_name, source.mapping);
}

async function buildPreview(sourceId: string, spreadsheetId: string, sheetName: string, mapping: SheetMapping) {
  const { supabase, user } = await getAdminContext();

  try {
    const sheetRows = await readGoogleSheetRows(spreadsheetId, sheetName, mapping);
    const previewRows: PreviewRow[] = [];

    for (const [index, row] of sheetRows.entries()) {
      previewRows.push(await classifyRow(row, index));
    }

    const failedRows = previewRows.filter((row) => row.status === "помилка").length;
    const { data: importRun, error } = await supabase
      .from("google_sheet_imports")
      .insert({
        source_id: sourceId,
        started_by_user_id: user.id,
        status: "pending",
        rows_total: previewRows.length,
        rows_failed: failedRows,
        metadata: {
          previewRows,
          mapping,
          mode: "preview",
          note: "One-way import. Manual changes are not overwritten.",
        },
      })
      .select("id")
      .single();

    if (error || !importRun) {
      redirect("/imports?error=preview_save");
    }

    if (failedRows > 0) {
      await createImportErrorNotification(importRun.id, failedRows);
    }

    revalidatePath("/imports");
    redirect(`/imports?import_id=${importRun.id}&success=preview_ready`);
  } catch {
    await createImportErrorNotification(sourceId, 1);
    redirect("/imports?error=preview_failed");
  }
}

async function classifyRow(
  row: Omit<PreviewRow, "status" | "message" | "duplicateCaseId">,
  index: number,
): Promise<PreviewRow> {
  const { supabase } = await getAdminContext();

  if (!row.projectTitle || !row.clientName || !row.managerEmail) {
    return {
      ...row,
      index,
      status: "помилка",
      message: "Потрібні назва проєкту, клієнт і менеджер.",
    };
  }

  const { data: manager } = await supabase
    .from("profiles")
    .select("id,email")
    .eq("email", row.managerEmail)
    .maybeSingle<{ id: string; email: string }>();

  if (!manager) {
    return {
      ...row,
      index,
      status: "помилка",
      message: "Менеджера з таким email не знайдено.",
    };
  }

  const { data: city } = row.city
    ? await supabase.from("cities").select("id,name").ilike("name", row.city).maybeSingle<{ id: string; name: string }>()
    : { data: null };

  const { data: imported } = await supabase
    .from("cases")
    .select("id")
    .eq("metadata->>googleSheetRowId", row.googleSheetRowId)
    .maybeSingle<{ id: string }>();

  if (imported) {
    return {
      ...row,
      index,
      status: "вже імпортовано",
      message: "Рядок уже був імпортований.",
      duplicateCaseId: imported.id,
    };
  }

  const { data: possibleDuplicates } = await supabase
    .from("cases")
    .select("id")
    .eq("title", row.projectTitle)
    .eq("owner_user_id", manager.id)
    .eq("metadata->>clientName", row.clientName)
    .eq("metadata->scoringInput->>launchDate", row.launchDate)
    .limit(1);

  if (possibleDuplicates?.length || (row.city && !city)) {
    return {
      ...row,
      index,
      status: row.city && !city ? "помилка" : "можливий дубль",
      message: row.city && !city ? "Місто не знайдено в довіднику." : "Схожий кейс уже існує.",
      duplicateCaseId: possibleDuplicates?.[0]?.id,
    };
  }

  return {
    ...row,
    index,
    status: "новий",
    message: "Готовий до імпорту.",
  };
}

export async function confirmImportAction(formData: FormData) {
  const { supabase, user } = await getAdminContext();
  const importId = readText(formData, "importId");
  const selectedRows = new Set(formData.getAll("rowIndex").map((value) => Number(value)));

  if (!importId || selectedRows.size === 0) {
    redirect(`/imports?import_id=${importId}&error=no_rows_selected`);
  }

  const { data: importRun } = await supabase
    .from("google_sheet_imports")
    .select("id,source_id,metadata")
    .eq("id", importId)
    .single<{ id: string; source_id: string; metadata: { previewRows?: PreviewRow[] } }>();

  const rows = importRun?.metadata.previewRows ?? [];
  let created = 0;
  let failed = 0;

  for (const row of rows) {
    if (!selectedRows.has(row.index) || row.status !== "новий") {
      continue;
    }

    const result = await importRow(row, user.id);
    if (result) {
      created += 1;
    } else {
      failed += 1;
    }
  }

  await supabase
    .from("google_sheet_imports")
    .update({
      status: failed > 0 ? "failed" : "completed",
      rows_created: created,
      rows_failed: failed,
      finished_at: new Date().toISOString(),
      metadata: {
        ...(importRun?.metadata ?? {}),
        confirmedRowIndexes: Array.from(selectedRows),
      },
    })
    .eq("id", importId);

  if (failed > 0) {
    await createImportErrorNotification(importId, failed);
  }

  revalidatePath("/imports");
  revalidatePath("/cases");
  redirect(`/imports?import_id=${importId}&success=import_completed`);
}

async function importRow(row: PreviewRow, actorUserId: string) {
  const { supabase } = await getAdminContext();
  const { data: manager } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", row.managerEmail)
    .single<{ id: string }>();
  const { data: city } = row.city
    ? await supabase.from("cities").select("id").ilike("name", row.city).maybeSingle<{ id: string }>()
    : { data: null };

  if (!manager) {
    return false;
  }

  const scoringInput = {
    launchDate: row.launchDate,
    permissionStatus: row.permissionStatus,
    hasShowcase: false,
    isRecognizableClient: false,
    isComplexProject: false,
    hasMetricOrEffect: "",
    hasCommentPerson: false,
    hasPhotoOrVideo: false,
  };
  const scoring = calculateCaseScore(scoringInput);

  const { data: createdCase, error } = await supabase
    .from("cases")
    .insert({
      title: row.projectTitle,
      summary: row.summary || `Кейс клієнта ${row.clientName}`,
      owner_user_id: manager.id,
      created_by_user_id: actorUserId,
      city_id: city?.id ?? null,
      project_status: "Новий",
      marketing_status: "Новий",
      score: scoring.score,
      metadata: {
        clientName: row.clientName,
        googleSheetRowId: row.googleSheetRowId,
        importedFrom: "google_sheets",
        importedAt: new Date().toISOString(),
        scoringInput,
        scoring,
        priority: scoring.priority,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !createdCase) {
    return false;
  }

  await supabase.from("case_activity_log").insert({
    case_id: createdCase.id,
    actor_user_id: actorUserId,
    action: "google_sheet_import.imported",
    metadata: {
      googleSheetRowId: row.googleSheetRowId,
      clientName: row.clientName,
    },
  });

  return true;
}

async function createImportErrorNotification(contextId: string, failedRows: number) {
  const { supabase, user } = await getAdminContext();
  const { data: admins } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("role", "admin")
    .eq("is_active", true);

  const { data: event } = await supabase
    .from("notification_events")
    .insert({
      type: "google_sheet_import_error",
      title: "Помилки імпорту Google Sheets",
      body: `Імпорт має помилки: ${failedRows} рядків потребують перевірки.`,
      actor_user_id: user.id,
      metadata: { contextId, failedRows },
      dedupe_key: `google_sheet_import_error:${contextId}`,
    })
    .select("id")
    .single<{ id: string }>();

  if (!event || !admins?.length) {
    return;
  }

  await supabase.from("notification_recipients").insert(
    admins.map((admin) => ({
      event_id: event.id,
      recipient_user_id: admin.id,
      recipient_role_snapshot: admin.role,
    })),
  );
}
