"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { caseFileBucket, isAllowedCaseFile } from "@/lib/cases/files";
import { booleanFromFormValue, calculateCaseScore, scoringCriteria } from "@/lib/cases/scoring";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function readOptionalText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value ? value : null;
}

async function resolveCityId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, formData: FormData) {
  const selectedCityId = readOptionalText(formData, "cityId");
  const cityName = readText(formData, "cityName");

  if (!cityName) {
    return selectedCityId;
  }

  const { data: existingCity } = await supabase
    .from("cities")
    .select("id")
    .ilike("name", cityName)
    .maybeSingle<{ id: string }>();

  if (existingCity?.id) {
    return existingCity.id;
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: createdCity } = await adminSupabase
    .from("cities")
    .insert({ name: cityName, sort_order: 998, is_active: true })
    .select("id")
    .single<{ id: string }>();

  return createdCity?.id ?? selectedCityId;
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

function buildCaseMetadata(formData: FormData, currentMetadata: Record<string, unknown> = {}) {
  const marketingMonitoring = {
    paymentStatus: readOptionalText(formData, "paymentStatus"),
    equipmentApproved: booleanFromFormValue(formData.get("equipmentApproved")),
    keyDate: readOptionalText(formData, "keyDate"),
    projectStage: readOptionalText(formData, "projectStage"),
    isHighProfile: booleanFromFormValue(formData.get("isHighProfile")),
    bigCheck: booleanFromFormValue(formData.get("bigCheck")),
  };
  const scoringInput = {
    ...Object.fromEntries(
      scoringCriteria.map((criterion) => [criterion.key, booleanFromFormValue(formData.get(criterion.key))]),
    ),
    hasFeasibleDates: Boolean(marketingMonitoring.keyDate),
  };
  const scoring = calculateCaseScore(scoringInput);

  return {
    metadata: {
      ...currentMetadata,
      contactName: readOptionalText(formData, "contactName"),
      contactPhone: readOptionalText(formData, "contactPhone"),
      source: readOptionalText(formData, "source"),
      expectedValue: readOptionalText(formData, "expectedValue"),
      notes: readOptionalText(formData, "notes"),
      marketingMonitoring,
      scoringInput,
      scoring,
      priority: scoring.priority,
    },
    scoring,
  };
}

async function createHotCaseNotification(caseId: string, actorUserId: string, title: string, score: number) {
  const { supabase } = await getCurrentUser();
  await supabase.from("notification_events").insert({
    case_id: caseId,
    type: "case_hot",
    title: "Гарячий кейс",
    body: `Кейс «${title}» набрав ${score} балів і потребує уваги маркетингу.`,
    actor_user_id: actorUserId,
    metadata: { score },
    dedupe_key: `case:${caseId}:case_hot`,
  });
}

export async function createCaseAction(formData: FormData) {
  const title = readText(formData, "title");
  const summary = readText(formData, "summary");
  const segmentId = readOptionalText(formData, "segmentId");
  const projectStatus = readOptionalText(formData, "projectStatus");
  const cityName = readText(formData, "cityName");

  if (!title || !summary || !segmentId || !projectStatus || !cityName) {
    redirect("/cases/new?error=required");
  }

  const { supabase, user } = await getCurrentUser();
  const { metadata, scoring } = buildCaseMetadata(formData);
  const cityId = await resolveCityId(supabase, formData);

  const { data, error } = await supabase
    .from("cases")
    .insert({
      title,
      summary,
      owner_user_id: user.id,
      created_by_user_id: user.id,
      segment_id: segmentId,
      city_id: cityId,
      project_status: projectStatus,
      marketing_status: "Новий",
      score: scoring.score,
      metadata,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/cases/new?error=create");
  }

  await writeActivity(data.id, user.id, "case.created", { title });
  await writeActivity(data.id, user.id, "case.scored", { score: scoring.score, priority: scoring.priority });

  if (scoring.priority === "Гарячий кейс") {
    await createHotCaseNotification(data.id, user.id, title, scoring.score);
  }

  revalidatePath("/cases");
  redirect(`/cases/${data.id}?success=created`);
}

export async function updateCaseAction(formData: FormData) {
  const caseId = readText(formData, "caseId");
  const title = readText(formData, "title");
  const summary = readText(formData, "summary");
  const segmentId = readOptionalText(formData, "segmentId");
  const projectStatus = readOptionalText(formData, "projectStatus");
  const cityName = readText(formData, "cityName");

  if (!caseId || !title || !summary || !segmentId || !projectStatus || !cityName) {
    redirect(caseId ? `/cases/${caseId}?error=required` : "/cases?error=missing");
  }

  const { supabase, user } = await getCurrentUser();
  const { data: current } = await supabase.from("cases").select("metadata").eq("id", caseId).single();
  const currentMetadata =
    current?.metadata && typeof current.metadata === "object" ? (current.metadata as Record<string, unknown>) : {};

  const previousPriority =
    typeof currentMetadata.priority === "string" ? currentMetadata.priority : undefined;
  const { metadata, scoring } = buildCaseMetadata(formData, currentMetadata);
  const cityId = await resolveCityId(supabase, formData);

  const { error } = await supabase
    .from("cases")
    .update({
      title,
      summary,
      segment_id: segmentId,
      city_id: cityId,
      project_status: projectStatus,
      score: scoring.score,
      metadata,
    })
    .eq("id", caseId);

  if (error) {
    redirect(`/cases/${caseId}?error=update`);
  }

  await writeActivity(caseId, user.id, "case.updated", { title });
  await writeActivity(caseId, user.id, "case.scored", { score: scoring.score, priority: scoring.priority });

  if (previousPriority !== "Гарячий кейс" && scoring.priority === "Гарячий кейс") {
    await createHotCaseNotification(caseId, user.id, title, scoring.score);
  }

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

export async function uploadCaseFileAction(formData: FormData) {
  const caseId = readText(formData, "caseId");
  const file = formData.get("file");

  if (!caseId || !(file instanceof File) || file.size === 0) {
    redirect(caseId ? `/cases/${caseId}?error=file_required` : "/cases?error=missing");
  }

  if (!isAllowedCaseFile(file)) {
    redirect(`/cases/${caseId}?error=file_type`);
  }

  const { supabase, user } = await getCurrentUser();
  const { data: caseAccess } = await supabase.from("cases").select("id").eq("id", caseId).single();

  if (!caseAccess) {
    redirect(`/cases/${caseId}?error=file_access`);
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${caseId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(caseFileBucket).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    redirect(`/cases/${caseId}?error=file_upload`);
  }

  const { error: recordError } = await supabase.from("case_files").insert({
    case_id: caseId,
    uploaded_by_user_id: user.id,
    storage_bucket: caseFileBucket,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  });

  if (recordError) {
    await supabase.storage.from(caseFileBucket).remove([storagePath]);
    redirect(`/cases/${caseId}?error=file_upload`);
  }

  await writeActivity(caseId, user.id, "file.uploaded", {
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}?success=file_uploaded`);
}
