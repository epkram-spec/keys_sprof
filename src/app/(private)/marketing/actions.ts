"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AppRole } from "@/lib/auth/types";
import { marketingStatusOptions } from "@/lib/cases/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getCurrentProfile() {
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
    .maybeSingle<{ id: string; role: AppRole; is_active: boolean }>();

  if (!profile?.is_active) {
    redirect("/login?error=inactive");
  }

  return { supabase, user, role: profile.role };
}

export async function updateMarketingStatusAction(formData: FormData) {
  const caseId = readText(formData, "caseId");
  const nextStatus = readText(formData, "marketingStatus");

  if (!caseId || !marketingStatusOptions.includes(nextStatus)) {
    redirect("/marketing?error=invalid_status");
  }

  const { supabase, user, role } = await getCurrentProfile();

  if (!["marketing", "leader", "admin"].includes(role)) {
    redirect("/marketing?error=forbidden");
  }

  const { data: currentCase, error: readError } = await supabase
    .from("cases")
    .select("marketing_status,title")
    .eq("id", caseId)
    .single<{ marketing_status: string | null; title: string }>();

  if (readError || !currentCase) {
    redirect("/marketing?error=case_not_found");
  }

  const previousStatus = currentCase.marketing_status ?? "Новий";

  if (previousStatus === nextStatus) {
    redirect("/marketing?success=no_changes");
  }

  const { error } = await supabase.from("cases").update({ marketing_status: nextStatus }).eq("id", caseId);

  if (error) {
    redirect("/marketing?error=update_failed");
  }

  await supabase.from("case_activity_log").insert({
    case_id: caseId,
    actor_user_id: user.id,
    action: "marketing.status_changed",
    metadata: {
      title: currentCase.title,
      previousStatus,
      nextStatus,
    },
  });

  revalidatePath("/marketing");
  revalidatePath(`/cases/${caseId}`);
  redirect("/marketing?success=status_updated");
}
