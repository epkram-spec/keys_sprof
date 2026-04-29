"use server";

import { redirect } from "next/navigation";

import { getAuthErrorMessage } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginActionState = {
  error?: string;
};

export async function loginAction(_state: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Вкажіть електронну пошту і пароль.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: getAuthErrorMessage(error.code, error.message),
    };
  }

  redirect("/overview");
}
