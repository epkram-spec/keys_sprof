import nodemailer from "nodemailer";

import { env } from "@/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DeliveryRecipient = {
  id: string;
  recipient_user_id: string;
  email_status: string;
  telegram_status: string;
  notification_events: {
    id: string;
    case_id: string | null;
    type: string;
    title: string;
    body: string;
  dedupe_key?: string | null;
  } | null;
  profiles: {
    email: string;
    notification_email_enabled: boolean;
    telegram_chat_id: string | null;
    notification_telegram_enabled: boolean;
  } | null;
};

export async function deliverPendingNotifications(limit = 25) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("notification_recipients")
    .select(
      `
        id,recipient_user_id,email_status,telegram_status,
        notification_events(id,case_id,type,title,body,dedupe_key),
        profiles!notification_recipients_recipient_user_id_fkey(email,notification_email_enabled,telegram_chat_id,notification_telegram_enabled)
      `,
    )
    .or("email_status.eq.pending,telegram_status.eq.pending")
    .limit(limit);

  const recipients = (data ?? []) as unknown as DeliveryRecipient[];

  for (const recipient of recipients) {
    await deliverEmail(recipient);
    await deliverTelegram(recipient);
  }

  return { processed: recipients.length };
}

async function deliverEmail(recipient: DeliveryRecipient) {
  if (recipient.email_status !== "pending") {
    return;
  }

  const profile = recipient.profiles;
  const event = recipient.notification_events;

  if (!profile?.email || !profile.notification_email_enabled) {
    await updateRecipient(recipient.id, { email_status: "skipped" });
    return;
  }

  if (!event) {
    await updateRecipient(recipient.id, { email_status: "failed", failed_reason: "Сповіщення не знайдено." });
    return;
  }

  try {
    await sendEmail(profile.email, event.title, event.body, event.case_id);
    await updateRecipient(recipient.id, {
      email_status: "sent",
      email_sent_at: new Date().toISOString(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Помилка email-доставки.";
    await updateRecipient(recipient.id, { email_status: "failed", failed_reason: reason });
    await createAdminFailureNotification("email", event.title, reason, event.id);
  }
}

async function deliverTelegram(recipient: DeliveryRecipient) {
  if (recipient.telegram_status !== "pending") {
    return;
  }

  const profile = recipient.profiles;
  const event = recipient.notification_events;

  if (!profile?.telegram_chat_id || !profile.notification_telegram_enabled) {
    await updateRecipient(recipient.id, { telegram_status: "skipped" });
    return;
  }

  if (!event) {
    await updateRecipient(recipient.id, { telegram_status: "failed", failed_reason: "Сповіщення не знайдено." });
    return;
  }

  try {
    await sendTelegram(profile.telegram_chat_id, event.title, event.body, event.case_id);
    await updateRecipient(recipient.id, {
      telegram_status: "sent",
      telegram_sent_at: new Date().toISOString(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Помилка Telegram-доставки.";
    await updateRecipient(recipient.id, { telegram_status: "failed", failed_reason: reason });
    await createAdminFailureNotification("telegram", event.title, reason, event.id);
  }
}

async function sendEmail(to: string, subject: string, body: string, caseId: string | null) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error("SMTP не налаштований.");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  const caseUrl = caseId ? `${env.NEXT_PUBLIC_APP_URL}/cases/${caseId}` : env.NEXT_PUBLIC_APP_URL;

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text: `${body}\n\nВідкрити: ${caseUrl}`,
  });
}

async function sendTelegram(chatId: string, title: string, body: string, caseId: string | null) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Telegram bot token не налаштований.");
  }

  const caseUrl = caseId ? `\n\nВідкрити кейс: ${env.NEXT_PUBLIC_APP_URL}/cases/${caseId}` : "";
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `${title}\n\n${body}${caseUrl}`,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API повернув ${response.status}.`);
  }
}

async function updateRecipient(recipientId: string, values: Record<string, string | null>) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("notification_recipients").update(values).eq("id", recipientId);
}

async function createAdminFailureNotification(channel: string, title: string, reason: string, eventId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: admins } = await supabase.from("profiles").select("id,role").eq("role", "admin").eq("is_active", true);
  const dedupeKey = `notification_delivery_failed:${channel}:${eventId}`;
  const { data: event } = await supabase
    .from("notification_events")
    .insert({
      type: "notification_delivery_failed",
      title: "Помилка доставки сповіщення",
      body: `Канал: ${channel}. Сповіщення: ${title}. Причина: ${reason}`,
      metadata: { channel, eventId, reason },
      dedupe_key: dedupeKey,
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
      email_status: "skipped",
      telegram_status: "skipped",
    })),
  );
}
