export type NotificationRecipientRow = {
  id: string;
  event_id: string;
  recipient_user_id: string;
  recipient_role_snapshot: string;
  in_app_status: "unread" | "read";
  read_at: string | null;
  email_status: string;
  email_sent_at: string | null;
  telegram_status: string;
  telegram_sent_at: string | null;
  failed_reason: string | null;
  created_at: string;
  notification_events: {
    id: string;
    case_id: string | null;
    type: string;
    title: string;
    body: string;
    created_at: string;
  } | null;
};
