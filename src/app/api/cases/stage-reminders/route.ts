import { NextResponse } from "next/server";

import { env } from "@/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReminderCase = {
  id: string;
  title: string;
  owner_user_id: string;
  marketing_status: string | null;
  metadata: Record<string, unknown> | null;
  owner?: { role: string | null } | null;
};

const weekMs = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || request.headers.get("x-cron-secret");

  if (env.CRON_SECRET && token !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Немає доступу." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cases")
    .select("id,title,owner_user_id,marketing_status,metadata,owner:profiles!cases_owner_user_id_fkey(role)")
    .is("archived_at", null);

  if (error) {
    return NextResponse.json({ error: "Не вдалося перевірити кейси." }, { status: 500 });
  }

  const now = new Date();
  const weekKey = getWeekKey(now);
  const candidates = ((data ?? []) as unknown as ReminderCase[]).filter((caseItem) =>
    shouldRemind(caseItem, now),
  );
  let created = 0;

  for (const caseItem of candidates) {
    const monitoring = getMonitoring(caseItem);
    const stage = getText(monitoring, "projectStage") || "Не вказано";
    const dedupeKey = `case:${caseItem.id}:stage_idle_week:${slug(stage)}:${weekKey}`;
    const { data: event } = await supabase
      .from("notification_events")
      .upsert(
        {
          case_id: caseItem.id,
          type: "case_stage_idle_week",
          title: "Кейс тиждень без змін",
          body: `Кейс «${caseItem.title}» уже тиждень на стадії «${stage}». Перевірте, чи є зміни, які треба внести.`,
          actor_user_id: null,
          metadata: {
            stage,
            stageChangedAt: getText(monitoring, "stageChangedAt"),
            stagePlannedDate: getText(monitoring, "stagePlannedDate") || getText(monitoring, "keyDate"),
          },
          dedupe_key: dedupeKey,
        },
        { onConflict: "dedupe_key" },
      )
      .select("id")
      .single<{ id: string }>();

    if (!event?.id) {
      continue;
    }

    const { error: recipientError } = await supabase.from("notification_recipients").upsert(
      {
        event_id: event.id,
        recipient_user_id: caseItem.owner_user_id,
        recipient_role_snapshot: caseItem.owner?.role ?? "manager",
        in_app_status: "unread",
        email_status: "pending",
        telegram_status: "pending",
      },
      { onConflict: "event_id,recipient_user_id" },
    );

    if (!recipientError) {
      created += 1;
    }
  }

  return NextResponse.json({ checked: data?.length ?? 0, reminders: created });
}

function shouldRemind(caseItem: ReminderCase, now: Date) {
  if (caseItem.marketing_status === "Опубліковано" || caseItem.marketing_status === "Архів") {
    return false;
  }

  const monitoring = getMonitoring(caseItem);
  const stageChangedAt = getText(monitoring, "stageChangedAt");
  const projectStage = getText(monitoring, "projectStage");

  if (!projectStage || !stageChangedAt) {
    return false;
  }

  const changedAt = new Date(stageChangedAt);
  return Number.isFinite(changedAt.getTime()) && now.getTime() - changedAt.getTime() >= weekMs;
}

function getMonitoring(caseItem: ReminderCase) {
  const monitoring = caseItem.metadata?.marketingMonitoring;
  return monitoring && typeof monitoring === "object" ? (monitoring as Record<string, unknown>) : {};
}

function getText(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function getWeekKey(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return `${date.getFullYear()}-${String(Math.ceil((day + start.getDay() + 1) / 7)).padStart(2, "0")}`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}
