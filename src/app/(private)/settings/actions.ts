"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTelegramStartToken } from "@/lib/telegram/linking";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function createTelegramLinkTokenAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const token = createTelegramStartToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  await supabase.from("telegram_link_tokens").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt,
  });

  revalidatePath("/settings");
  redirect("/settings?success=telegram_token");
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await supabase.rpc("update_own_notification_settings", {
    email_enabled: formData.get("emailEnabled") === "on",
    telegram_enabled: formData.get("telegramEnabled") === "on",
  });

  revalidatePath("/settings");
  redirect("/settings?success=preferences");
}
