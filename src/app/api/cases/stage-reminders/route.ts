import { NextResponse } from "next/server";

import { env } from "@/env";
import { createNotification } from "@/lib/notifications/create";
import { getBearerToken, getRequiredSecret } from "@/lib/security/secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ReminderCase = {
  id: string;
  title: string;
  owner_user_id: string;
  marketing_status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  owner?: { role: string | null } | null;
};

const weekMs = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  let cronSecret: string;

  try {
    cronSecret = getRequiredSecret("CRON_SECRET", env.CRON_SECRET);
  } catch {
    return NextResponse.json({ error: "Службовий ключ не налаштований." }, { status: 503 });
  }

  if (getBearerToken(request) !== cronSecret) {
    return NextResponse.json({ error: "Немає доступу." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cases")
    .select("id,title,owner_user_id,marketing_status,metadata,created_at,owner:profiles!cases_owner_user_id_fkey(role)")
    .is("archived_at", null);

  if (error) {
    return NextResponse.json({ error: "Не вдалося перевірити кейси." }, { status: 500 });
  }

  const now = new Date();
  const weekKey = getWeekKey(now);
  const cases = (data ?? []) as unknown as ReminderCase[];
  const candidates = cases.filter((caseItem) => shouldRemind(caseItem, now));
  let created = 0;

  for (const caseItem of candidates) {
    const monitoring = getMonitoring(caseItem);
    const stage = getText(monitoring, "projectStage") || "Не вказано";
    const dedupeKey = `case:${caseItem.id}:stage_idle_week:${slug(stage)}:${weekKey}`;
    await createNotification({
      type: "case_stage_idle_week",
      title: "Кейс тиждень без змін",
      body: `Кейс «${caseItem.title}» уже тиждень на стадії «${stage}». Перевірте, чи є зміни, які треба внести.`,
      caseId: caseItem.id,
      actorUserId: null,
      recipientUserIds: [caseItem.owner_user_id],
      priority: "normal",
      metadata: {
        stage,
        stageChangedAt: getText(monitoring, "stageChangedAt"),
        stagePlannedDate: getText(monitoring, "stagePlannedDate") || getText(monitoring, "keyDate"),
      },
      dedupeKey,
    });
    created += 1;
  }

  for (const caseItem of cases.filter((item) => hasDueStageDate(item, now))) {
    const monitoring = getMonitoring(caseItem);
    const plannedDate = getText(monitoring, "stagePlannedDate") || getText(monitoring, "keyDate");
    await createNotification({
      type: "case_stage_due",
      title: "Настала планова дата",
      body: `Для кейсу «${caseItem.title}» настала планова дата стадії. Перевірте, чи потрібно оновити картку.`,
      caseId: caseItem.id,
      actorUserId: null,
      recipientUserIds: [caseItem.owner_user_id],
      priority: "normal",
      metadata: { plannedDate, stage: getText(monitoring, "projectStage") },
      dedupeKey: `case:${caseItem.id}:stage_due:${plannedDate}`,
    });
    created += 1;
  }

  for (const caseItem of cases.filter((item) => isIncompleteAfterThreeDays(item, now))) {
    await createNotification({
      type: "case_incomplete_three_days",
      title: "Кейс варто доповнити",
      body: `Кейс «${caseItem.title}» створено понад 3 дні тому, але в ньому ще бракує деталей для маркетингу.`,
      caseId: caseItem.id,
      actorUserId: null,
      recipientUserIds: [caseItem.owner_user_id],
      priority: "low",
      metadata: { createdAt: caseItem.created_at },
      dedupeKey: `case:${caseItem.id}:incomplete_three_days`,
    });
    created += 1;
  }

  return NextResponse.json(
    { checked: data?.length ?? 0, reminders: created },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
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

function hasDueStageDate(caseItem: ReminderCase, now: Date) {
  if (caseItem.marketing_status === "Архів") {
    return false;
  }

  const monitoring = getMonitoring(caseItem);
  const plannedDate = getText(monitoring, "stagePlannedDate") || getText(monitoring, "keyDate");
  if (!plannedDate) {
    return false;
  }

  const due = new Date(plannedDate);
  if (!Number.isFinite(due.getTime())) {
    return false;
  }

  const todayKey = now.toISOString().slice(0, 10);
  return plannedDate.slice(0, 10) <= todayKey;
}

function isIncompleteAfterThreeDays(caseItem: ReminderCase, now: Date) {
  const createdAt = new Date(caseItem.created_at);
  if (!Number.isFinite(createdAt.getTime()) || now.getTime() - createdAt.getTime() < 3 * 24 * 60 * 60 * 1000) {
    return false;
  }

  const metadata = caseItem.metadata ?? {};
  const monitoring = getMonitoring(caseItem);
  const scoringInput = getObject(metadata.scoringInput);
  const filled = [
    scoringInput.hasVisualShowcase,
    getText(scoringInput, "hasClientTask"),
    getText(scoringInput, "hasSprofSolution"),
    getText(scoringInput, "hasMetricOrEffect"),
    getText(scoringInput, "hasVisualHook"),
    getText(monitoring, "projectStage"),
    getText(monitoring, "stagePlannedDate") || getText(monitoring, "keyDate"),
    getText(metadata, "contactName"),
    getText(metadata, "source"),
  ].filter(Boolean).length;

  return filled < 5;
}

function getMonitoring(caseItem: ReminderCase) {
  const monitoring = caseItem.metadata?.marketingMonitoring;
  return monitoring && typeof monitoring === "object" ? (monitoring as Record<string, unknown>) : {};
}

function getText(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function getObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getWeekKey(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return `${date.getFullYear()}-${String(Math.ceil((day + start.getDay() + 1) / 7)).padStart(2, "0")}`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}
