import type { CaseMetadata, CaseRow } from "@/lib/cases/types";
import { legacyStageMapping } from "@/lib/cases/types";

export const activityLabels: Record<string, string> = {
  "case.created": "Кейс створено",
  "case.updated": "Кейс оновлено",
  "case.scored": "Оцінку кейсу оновлено",
  "case.transferred_to_marketing": "Кейс передано в маркетинг",
  "comment.created": "Коментар додано",
  "file.uploaded": "Файл додано",
  "marketing.status_changed": "Маркетолог змінив статус",
  "google_sheet_import.imported": "Імпорт з Google Sheets виконано",
  "google_sheet_import.updated": "Імпорт з Google Sheets оновив кейс",
  "google_sheet_import_error": "Помилки імпорту Google Sheets",
  "case_hot": "Кейс став гарячим",
  "case_stage_due": "Настала планова дата",
  "case_stage_idle_week": "Кейс тиждень без змін",
  "case_incomplete_three_days": "Кейс варто доповнити",
  "case.updated_after_marketing_transfer": "Кейс оновлено після передачі",
  "notification_delivery_failed": "Помилка доставки сповіщення",
  "admin.user_created": "Адміністратор створив користувача",
  "admin.user_role_updated": "Адміністратор змінив роль",
  "admin.segment_saved": "Довідник сегментів оновлено",
  "admin.city_saved": "Довідник міст оновлено",
  "admin.case_archived": "Кейс архівовано",
};

export function getObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function getMetadataText(metadata: CaseMetadata | Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

export function getProjectStage(caseItem: CaseRow) {
  const monitoring = getObject(caseItem.metadata?.marketingMonitoring);
  const raw = monitoring.projectStage;
  const stage = typeof raw === "string" ? raw : "";
  return legacyStageMapping[stage] ?? stage;
}

export function isMarketingTransferred(caseItem: Pick<CaseRow, "marketing_status">) {
  return Boolean(caseItem.marketing_status && caseItem.marketing_status !== "Новий");
}

export function getCaseOwnerRecipients(caseItem: Pick<CaseRow, "owner_user_id">, actorUserId: string) {
  return caseItem.owner_user_id && caseItem.owner_user_id !== actorUserId ? [caseItem.owner_user_id] : [];
}
