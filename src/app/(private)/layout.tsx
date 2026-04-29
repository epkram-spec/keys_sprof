import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import type { AppRole, Profile } from "@/lib/auth/types";
import { getNotificationSummary } from "@/lib/notifications/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,role,display_name,is_active")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const fallbackProfile: Profile = {
    id: user.id,
    email: user.email ?? "",
    role: user.email?.toLowerCase() === "epkram@gmail.com" ? "admin" : ("manager" as AppRole),
    display_name: user.user_metadata.display_name ?? user.user_metadata.full_name ?? null,
    is_active: true,
  };

  const currentProfile = profile ?? fallbackProfile;

  if (!currentProfile.is_active) {
    redirect("/login?error=inactive");
  }

  const notifications = await getNotificationSummary(currentProfile.id);

  return (
    <AppShell notifications={notifications} profile={currentProfile}>
      {children}
    </AppShell>
  );
}
