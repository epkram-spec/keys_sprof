import Link from "next/link";
import {
  BarChart3,
  Bell,
  FileInput,
  FolderKanban,
  Home,
  LogOut,
  Megaphone,
  PlusCircle,
  Settings,
  Shield,
} from "lucide-react";

import { env } from "@/env";
import { logoutAction } from "@/app/(private)/actions";
import { Button } from "@/components/ui/button";
import type { AppRole, Profile } from "@/lib/auth/types";
import { roleLabels } from "@/lib/auth/types";
import type { NotificationRecipientRow } from "@/lib/notifications/types";

const navigation: Array<{
  href: string;
  label: string;
  icon: typeof Home;
  roles: AppRole[];
}> = [
  { href: "/overview", label: "Огляд", icon: Home, roles: ["manager", "marketing", "leader", "admin"] },
  { href: "/cases", label: "Кейси", icon: FolderKanban, roles: ["manager", "marketing", "leader", "admin"] },
  { href: "/cases/new", label: "Новий кейс", icon: PlusCircle, roles: ["manager", "leader", "admin"] },
  { href: "/marketing", label: "Маркетинг", icon: Megaphone, roles: ["marketing", "leader", "admin"] },
  { href: "/notifications", label: "Сповіщення", icon: Bell, roles: ["manager", "marketing", "leader", "admin"] },
  { href: "/imports", label: "Імпорт", icon: FileInput, roles: ["admin"] },
  { href: "/reports", label: "Звіти", icon: BarChart3, roles: ["leader", "admin"] },
  { href: "/settings", label: "Налаштування", icon: Settings, roles: ["manager", "marketing", "leader", "admin"] },
  { href: "/admin", label: "Адміністрування", icon: Shield, roles: ["admin"] },
];

export function AppShell({
  children,
  notifications,
  profile,
}: {
  children: React.ReactNode;
  notifications: { unreadCount: number; latest: NotificationRecipientRow[] };
  profile: Profile;
}) {
  const availableNavigation = navigation.filter((item) => item.roles.includes(profile.role));
  const displayName = profile.display_name || profile.email;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b bg-card/85 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center border-b px-5">
          <Link className="text-base font-semibold" href="/overview">
            {env.NEXT_PUBLIC_APP_NAME}
          </Link>
        </div>
        <nav className="grid gap-1 p-3">
          {availableNavigation.map((item) => (
            <Link
              className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Кабінет</p>
            <p className="text-sm font-semibold">{displayName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right text-xs text-muted-foreground sm:block">
              <span className="block">Роль</span>
              <span className="font-medium text-foreground">{roleLabels[profile.role]}</span>
            </div>
            <NotificationBell notifications={notifications} />
            <form action={logoutAction}>
              <Button aria-label="Вийти" size="icon" type="submit" variant="ghost">
                <LogOut className="size-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}

function NotificationBell({
  notifications,
}: {
  notifications: { unreadCount: number; latest: NotificationRecipientRow[] };
}) {
  return (
    <div className="group relative">
      <Button aria-label={`Сповіщення: ${notifications.unreadCount} нових`} size="icon" type="button" variant="outline">
        <span className="relative">
          <Bell className="size-4" aria-hidden="true" />
          <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
            {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
          </span>
        </span>
      </Button>
      <div className="invisible absolute right-0 top-12 z-20 w-[340px] rounded-lg border bg-popover p-3 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Сповіщення</h2>
          <Link className="text-sm font-medium text-primary hover:underline" href="/notifications">
            Усі
          </Link>
        </div>
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {notifications.latest.length ? (
            notifications.latest.map((item) => (
              <article className="rounded-md border bg-background p-3" key={item.id}>
                <p className="text-sm font-semibold">{item.notification_events?.title ?? "Сповіщення"}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {item.notification_events?.body ?? "Немає опису."}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {item.in_app_status === "unread" ? "Нове" : "Переглянуте"}
                  </span>
                  {item.notification_events?.case_id ? (
                    <Link className="text-xs font-medium text-primary hover:underline" href={`/cases/${item.notification_events.case_id}`}>
                      Відкрити кейс
                    </Link>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">Сповіщень немає.</p>
          )}
        </div>
      </div>
    </div>
  );
}
