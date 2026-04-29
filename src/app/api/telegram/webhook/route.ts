import { NextResponse } from "next/server";

import { env } from "@/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat: {
      id: number;
      username?: string;
    };
    from?: {
      username?: string;
    };
  };
};

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");

  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const text = update.message?.text ?? "";
  const token = text.startsWith("/start ") ? text.replace("/start ", "").trim() : "";

  if (!token || !update.message?.chat.id) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();
  const { data: linkToken } = await supabase
    .from("telegram_link_tokens")
    .select("id,user_id,expires_at,used_at")
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();

  if (!linkToken) {
    return NextResponse.json({ ok: true });
  }

  const username = update.message.chat.username ?? update.message.from?.username ?? null;

  await supabase
    .from("profiles")
    .update({
      telegram_chat_id: String(update.message.chat.id),
      telegram_username: username,
      notification_telegram_enabled: true,
    })
    .eq("id", linkToken.user_id);

  await supabase.from("telegram_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", linkToken.id);

  if (env.TELEGRAM_BOT_TOKEN) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: update.message.chat.id,
        text: "Telegram привʼязано до кабінету Радар кейсів SPROF.",
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
