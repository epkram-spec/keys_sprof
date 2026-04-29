import { createTelegramLinkTokenAction, updateNotificationPreferencesAction } from "@/app/(private)/settings/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { env } from "@/env";
import { buildTelegramStartUrl } from "@/lib/telegram/linking";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SettingsPageProps = {
  searchParams: Promise<{
    success?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: token }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email,telegram_chat_id,telegram_username,notification_email_enabled,notification_telegram_enabled")
      .eq("id", user?.id ?? "")
      .single<{
        email: string;
        telegram_chat_id: string | null;
        telegram_username: string | null;
        notification_email_enabled: boolean;
        notification_telegram_enabled: boolean;
      }>(),
    supabase
      .from("telegram_link_tokens")
      .select("token,expires_at")
      .eq("user_id", user?.id ?? "")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ token: string; expires_at: string }>(),
  ]);

  const telegramUrl =
    token?.token && env.TELEGRAM_BOT_USERNAME
      ? buildTelegramStartUrl(env.TELEGRAM_BOT_USERNAME, token.token)
      : null;

  return (
    <>
      <PageHeader title="Налаштування" description="Канали доставки сповіщень і привʼязка Telegram." />

      {params.success ? (
        <p className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          Налаштування оновлено.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Канали сповіщень</h2>
          <form action={updateNotificationPreferencesAction} className="mt-4 space-y-3">
            <label className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm font-medium">
              <input defaultChecked={profile?.notification_email_enabled ?? true} name="emailEnabled" type="checkbox" />
              Email-сповіщення
            </label>
            <label className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm font-medium">
              <input
                defaultChecked={profile?.notification_telegram_enabled ?? false}
                disabled={!profile?.telegram_chat_id}
                name="telegramEnabled"
                type="checkbox"
              />
              Telegram-сповіщення
            </label>
            <Button type="submit">Зберегти налаштування</Button>
          </form>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Telegram</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Створіть start token і відкрийте посилання в Telegram. Token діє 30 хвилин.
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Статус</dt>
              <dd className="font-medium">{profile?.telegram_chat_id ? "Привʼязано" : "Не привʼязано"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-medium">{profile?.telegram_username ?? "Не вказано"}</dd>
            </div>
          </dl>
          <form action={createTelegramLinkTokenAction} className="mt-4">
            <Button type="submit" variant="secondary">
              Створити start token
            </Button>
          </form>
          {telegramUrl ? (
            <a className="mt-4 block rounded-md border bg-background p-3 text-sm font-medium text-primary hover:underline" href={telegramUrl}>
              Відкрити Telegram для привʼязки
            </a>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Щоб побачити посилання, вкажіть `TELEGRAM_BOT_USERNAME` у env.</p>
          )}
        </section>
      </div>
    </>
  );
}
