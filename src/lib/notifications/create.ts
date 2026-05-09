import type { AppRole } from "@/lib/auth/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CreateNotificationParams = {
  type: string;
  title: string;
  body: string;
  caseId?: string | null;
  actorUserId?: string | null;
  recipientUserIds: string[];
  priority?: "high" | "normal" | "low";
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
};

type RecipientProfile = {
  id: string;
  role: AppRole;
};

/**
 * Creates a notification event and the recipient rows that make it visible in the bell.
 * This ensures every event is visible to at least one user in the bell icon.
 */
export async function createNotification({
  type,
  title,
  body,
  caseId,
  actorUserId,
  recipientUserIds,
  priority = "normal",
  metadata = {},
  dedupeKey,
}: CreateNotificationParams) {
  if (recipientUserIds.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const uniqueRecipientIds = Array.from(new Set(recipientUserIds)).filter((uid) => !actorUserId || uid !== actorUserId);

  if (uniqueRecipientIds.length === 0) {
    return;
  }

  // If dedupeKey is set, reuse the existing event and only add missing recipients.
  let eventId: string | null = null;
  if (dedupeKey) {
    const { data: existing } = await supabase
      .from("notification_events")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle<{ id: string }>();

    if (existing) {
      eventId = existing.id;
    }
  }

  if (!eventId) {
    const { data: event, error: eventError } = await supabase
      .from("notification_events")
      .insert({
        case_id: caseId ?? null,
        type,
        title,
        body,
        actor_user_id: actorUserId,
        metadata: { ...metadata, priority },
        dedupe_key: dedupeKey ?? null,
      })
      .select("id")
      .single<{ id: string }>();

    if (eventError || !event) {
      return;
    }

    eventId = event.id;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,role")
    .in("id", uniqueRecipientIds)
    .eq("is_active", true)
    .returns<RecipientProfile[]>();

  const createdEventId = eventId;
  const recipientRows = (profiles ?? []).map((profile) => ({
    event_id: createdEventId,
    recipient_user_id: profile.id,
    recipient_role_snapshot: profile.role,
    in_app_status: "unread" as const,
    email_status: "pending" as const,
    telegram_status: "pending" as const,
  }));

  if (recipientRows.length === 0) {
    return;
  }

  await supabase
    .from("notification_recipients")
    .upsert(recipientRows, { onConflict: "event_id,recipient_user_id" });
}

/**
 * Get all user IDs with a specific role (e.g., 'marketing', 'leader', 'admin').
 */
export async function getUserIdsByRole(...roles: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", roles)
    .eq("is_active", true);

  return (data ?? []).map((row) => row.id);
}
