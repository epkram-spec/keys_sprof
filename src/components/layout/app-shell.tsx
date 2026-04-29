import Link from "next/link";
import { Bell, FileInput, FolderKanban, Home, Megaphone, Settings, Shield, BarChart3 } from "lucide-react";

import { env } from "@/env";
import { Button } from "@/components/ui/button";

const navigation = [
  { href: "/overview", label: "Огляд", icon: Home },
  { href: "/cases", label: "Кейси", icon: FolderKanban },
  { href: "/marketing", label: "Маркетинг", icon: Megaphone },
  { href: "/notifications", label: "Сповіщення", icon: Bell },
  { href: "/imports", label: "Імпорт", icon: FileInput },
  { href: "/reports", label: "Звіти", icon: BarChart3 },
  { href: "/settings", label: "Налаштування", icon: Settings },
  { href: "/admin", label: "Адміністрування", icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b bg-card/85 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center border-b px-5">
          <Link className="text-base font-semibold" href="/overview">
            {env.NEXT_PUBLIC_APP_NAME}
          </Link>
        </div>
        <nav className="grid gap-1 p-3">
          {navigation.map((item) => (
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
          </div>
          <Button aria-label="Сповіщення" size="icon" type="button" variant="outline">
            <Bell className="size-4" aria-hidden="true" />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
