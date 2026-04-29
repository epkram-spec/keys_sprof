import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NotificationRecipientRow } from "@/lib/notifications/types";

export async function getNotificationSummary(userId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ count }, { data }] = await Promise.all([
    supabase
      .from("notification_recipients")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .eq("in_app_status", "unread"),
    supabase
      .from("notification_recipients")
      .select(
        `
          id,event_id,recipient_user_id,recipient_role_snapshot,in_app_status,read_at,
          email_status,email_sent_at,telegram_status,telegram_sent_at,failed_reason,created_at,
          notification_events(id,case_id,type,title,body,created_at)
        `,
      )
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    unreadCount: count ?? 0,
    latest: (data ?? []) as unknown as NotificationRecipientRow[],
  };
}
