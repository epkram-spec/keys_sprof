"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getCurrentUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, userId: user.id };
}

export async function markNotificationReadAction(formData: FormData) {
  const recipientId = readText(formData, "recipientId");
  const { supabase } = await getCurrentUserId();

  if (!recipientId) {
    redirect("/notifications?error=missing");
  }

  await supabase.rpc("mark_own_notification_read", {
    recipient_id: recipientId,
  });

  revalidatePath("/notifications");
  revalidatePath("/overview");
  redirect("/notifications?success=marked");
}

export async function markAllNotificationsReadAction() {
  const { supabase } = await getCurrentUserId();

  await supabase.rpc("mark_all_own_notifications_read");

  revalidatePath("/notifications");
  revalidatePath("/overview");
  redirect("/notifications?success=all_marked");
}
