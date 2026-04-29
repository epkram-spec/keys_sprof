"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value ? value : null;
}

function readOptionalNumber(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

async function writeActivity(caseId: string, actorUserId: string, action: string, metadata: Record<string, unknown>) {
  const { supabase } = await getCurrentUser();
  await supabase.from("case_activity_log").insert({
    case_id: caseId,
    actor_user_id: actorUserId,
    action,
    metadata,
  });
}

export async function createCaseAction(formData: FormData) {
  const title = readText(formData, "title");
  const summary = readText(formData, "summary");

  if (!title || !summary) {
    redirect("/cases/new?error=required");
  }

  const { supabase, user } = await getCurrentUser();
  const metadata = {
    contactName: readOptionalText(formData, "contactName"),
    contactPhone: readOptionalText(formData, "contactPhone"),
    source: readOptionalText(formData, "source"),
    expectedValue: readOptionalText(formData, "expectedValue"),
    notes: readOptionalText(formData, "notes"),
  };

  const { data, error } = await supabase
    .from("cases")
    .insert({
      title,
      summary,
      owner_user_id: user.id,
      created_by_user_id: user.id,
      segment_id: readOptionalText(formData, "segmentId"),
      city_id: readOptionalText(formData, "cityId"),
      project_status: readOptionalText(formData, "projectStatus") ?? "Новий",
      marketing_status: "Не передано",
      score: readOptionalNumber(formData, "score"),
      metadata,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/cases/new?error=create");
  }

  await writeActivity(data.id, user.id, "case.created", { title });
  revalidatePath("/cases");
  redirect(`/cases/${data.id}?success=created`);
}

export async function updateCaseAction(formData: FormData) {
  const caseId = readText(formData, "caseId");
  const title = readText(formData, "title");
  const summary = readText(formData, "summary");

  if (!caseId || !title || !summary) {
    redirect(caseId ? `/cases/${caseId}?error=required` : "/cases?error=missing");
  }

  const { supabase, user } = await getCurrentUser();
  const { data: current } = await supabase.from("cases").select("metadata").eq("id", caseId).single();
  const currentMetadata =
    current?.metadata && typeof current.metadata === "object" ? (current.metadata as Record<string, unknown>) : {};

  const metadata = {
    ...currentMetadata,
    contactName: readOptionalText(formData, "contactName"),
    contactPhone: readOptionalText(formData, "contactPhone"),
    source: readOptionalText(formData, "source"),
    expectedValue: readOptionalText(formData, "expectedValue"),
    notes: readOptionalText(formData, "notes"),
  };

  const { error } = await supabase
    .from("cases")
    .update({
      title,
      summary,
      segment_id: readOptionalText(formData, "segmentId"),
      city_id: readOptionalText(formData, "cityId"),
      project_status: readOptionalText(formData, "projectStatus") ?? "Новий",
      score: readOptionalNumber(formData, "score"),
      metadata,
    })
    .eq("id", caseId);

  if (error) {
    redirect(`/cases/${caseId}?error=update`);
  }

  await writeActivity(caseId, user.id, "case.updated", { title });
  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}?success=updated`);
}

export async function addCommentAction(formData: FormData) {
  const caseId = readText(formData, "caseId");
  const body = readText(formData, "body");

  if (!caseId || !body) {
    redirect(caseId ? `/cases/${caseId}?error=comment_required` : "/cases");
  }

  const { supabase, user } = await getCurrentUser();
  const { error } = await supabase.from("case_comments").insert({
    case_id: caseId,
    author_user_id: user.id,
    body,
  });

  if (error) {
    redirect(`/cases/${caseId}?error=comment`);
  }

  await writeActivity(caseId, user.id, "comment.created", { bodyPreview: body.slice(0, 80) });
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}?success=comment`);
}

export async function transferToMarketingAction(formData: FormData) {
  const caseId = readText(formData, "caseId");

  if (!caseId) {
    redirect("/cases?error=missing");
  }

  const { supabase, user } = await getCurrentUser();
  const { error } = await supabase.from("cases").update({ marketing_status: "Перевірити" }).eq("id", caseId);

  if (error) {
    redirect(`/cases/${caseId}?error=transfer`);
  }

  await writeActivity(caseId, user.id, "case.transferred_to_marketing", {
    marketingStatus: "Перевірити",
  });

  await supabase.from("notification_events").insert({
    case_id: caseId,
    type: "case.transferred_to_marketing",
    title: "Кейс передано в маркетинг",
    body: "Кейс очікує перевірки маркетингом.",
    actor_user_id: user.id,
    metadata: { marketingStatus: "Перевірити" },
    dedupe_key: `case:${caseId}:transferred_to_marketing`,
  });

  revalidatePath("/cases");
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}?success=transfer`);
}
