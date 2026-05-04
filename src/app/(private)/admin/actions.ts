"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AppRole } from "@/lib/auth/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    .single<{ id: string; role: AppRole; is_active: boolean }>();

  if (!profile?.is_active || profile.role !== "admin") {
    redirect("/overview");
  }

  return { supabase, user };
}

export async function updateUserRoleAction(formData: FormData) {
  const userId = readText(formData, "userId");
  const role = readText(formData, "role") as AppRole;
  const isActive = formData.get("isActive") === "on";

  if (!userId || !["manager", "marketing", "leader", "admin"].includes(role)) {
    redirect("/admin?error=user");
  }

  const { supabase, user } = await getAdminContext();
  await supabase.from("profiles").update({ role, is_active: isActive }).eq("id", userId);
  await supabase.from("case_activity_log").insert({
    actor_user_id: user.id,
    action: "admin.user_role_updated",
    metadata: { userId, role, isActive },
  });

  revalidatePath("/admin");
  redirect("/admin?success=user");
}

export async function createUserAction(formData: FormData) {
  const email = readText(formData, "email").toLowerCase();
  const password = readText(formData, "password");
  const displayName = readText(formData, "displayName") || null;
  const role = readText(formData, "role") as AppRole;
  const isActive = formData.get("isActive") === "on";

  if (!email || !password || password.length < 8 || !["manager", "marketing", "leader", "admin"].includes(role)) {
    redirect("/admin?error=user_create");
  }

  const { supabase, user } = await getAdminContext();
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error || !data.user) {
    redirect("/admin?error=user_create");
  }

  await supabase.from("profiles").upsert({
    id: data.user.id,
    email,
    role,
    display_name: displayName,
    is_active: isActive,
  });
  await supabase.from("case_activity_log").insert({
    actor_user_id: user.id,
    action: "admin.user_created",
    metadata: { userId: data.user.id, email, role, isActive },
  });

  revalidatePath("/admin");
  redirect("/admin?success=user_created");
}

export async function upsertSegmentAction(formData: FormData) {
  await upsertDirectory("case_segments", formData);
}

export async function upsertCityAction(formData: FormData) {
  await upsertDirectory("cities", formData);
}

async function upsertDirectory(table: "case_segments" | "cities", formData: FormData) {
  const id = readText(formData, "id");
  const name = readText(formData, "name");
  const sortOrder = Number(readText(formData, "sortOrder") || "999");
  const isActive = formData.get("isActive") === "on";
  const { supabase, user } = await getAdminContext();

  if (!name) {
    redirect("/admin?error=directory");
  }

  if (id) {
    await supabase.from(table).update({ name, sort_order: sortOrder, is_active: isActive }).eq("id", id);
  } else {
    await supabase.from(table).insert({ name, sort_order: sortOrder, is_active: isActive });
  }

  await supabase.from("case_activity_log").insert({
    actor_user_id: user.id,
    action: table === "case_segments" ? "admin.segment_saved" : "admin.city_saved",
    metadata: { id, name, sortOrder, isActive },
  });

  revalidatePath("/admin");
  redirect("/admin?success=directory");
}

export async function archiveCaseAction(formData: FormData) {
  const caseId = readText(formData, "caseId");
  const { supabase, user } = await getAdminContext();

  if (!caseId) {
    redirect("/admin?error=case");
  }

  await supabase.from("cases").update({ archived_at: new Date().toISOString() }).eq("id", caseId);
  await supabase.from("case_activity_log").insert({
    case_id: caseId,
    actor_user_id: user.id,
    action: "admin.case_archived",
    metadata: { caseId },
  });

  revalidatePath("/admin");
  redirect("/admin?success=case_archived");
}
