import Link from "next/link";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(private)/notifications/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/cases/format";
import type { NotificationRecipientRow } from "@/lib/notifications/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationsPageProps = {
  searchParams: Promise<{
    tab?: "new" | "read" | "all";
    success?: string;
    error?: string;
  }>;
};

const successMessages: Record<string, string> = {
  marked: "Сповіщення позначено як переглянуте.",
  all_marked: "Усі нові сповіщення позначено як переглянуті.",
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams;
  const activeTab = params.tab ?? "new";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("notification_recipients")
    .select(
      `
        id,event_id,recipient_user_id,recipient_role_snapshot,in_app_status,read_at,
        email_status,email_sent_at,telegram_status,telegram_sent_at,failed_reason,created_at,
        notification_events(id,case_id,type,title,body,created_at)
      `,
    )
    .eq("recipient_user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  if (activeTab === "new") {
    query = query.eq("in_app_status", "unread");
  }

  if (activeTab === "read") {
    query = query.eq("in_app_status", "read");
  }

  const { data } = await query;
  const notifications = (data ?? []) as unknown as NotificationRecipientRow[];

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader title="Сповіщення" description="Усі внутрішні сповіщення кабінету." />
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="secondary">
            Позначити всі як переглянуті
          </Button>
        </form>
      </div>

      {params.success ? (
        <p className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {successMessages[params.success] ?? "Дію виконано."}
        </p>
      ) : null}

      <nav className="mb-5 flex flex-wrap gap-2">
        <TabLink active={activeTab === "new"} href="/notifications?tab=new">
          Нові
        </TabLink>
        <TabLink active={activeTab === "read"} href="/notifications?tab=read">
          Переглянуті
        </TabLink>
        <TabLink active={activeTab === "all"} href="/notifications?tab=all">
          Усі
        </TabLink>
      </nav>

      <section className="space-y-3">
        {notifications.length ? (
          notifications.map((item) => <NotificationCard item={item} key={item.id} />)
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold">Сповіщень немає</h2>
            <p className="mt-2 text-sm text-muted-foreground">У цій вкладці поки немає записів.</p>
          </div>
        )}
      </section>
    </>
  );
}

function NotificationCard({ item }: { item: NotificationRecipientRow }) {
  const event = item.notification_events;

  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{event?.title ?? "Сповіщення"}</h2>
            <span className="rounded-md border bg-background px-2 py-1 text-xs font-medium">
              {item.in_app_status === "unread" ? "Нове" : "Переглянуте"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{event?.body ?? "Немає опису."}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDateTime(item.created_at)} · тип: {event?.type ?? "невідомо"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {event?.case_id ? (
            <Button asChild variant="outline">
              <Link href={`/cases/${event.case_id}`}>Відкрити кейс</Link>
            </Button>
          ) : null}
          {item.in_app_status === "unread" ? (
            <form action={markNotificationReadAction}>
              <input name="recipientId" type="hidden" value={item.id} />
              <Button type="submit" variant="secondary">
                Позначити як переглянуте
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TabLink({ active, children, href }: { active: boolean; children: React.ReactNode; href: string }) {
  return (
    <Link
      className={
        active
          ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          : "rounded-md border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
      }
      href={href}
    >
      {children}
    </Link>
  );
}
