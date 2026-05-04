"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  FileInput,
  FolderKanban,
  Home,
  Megaphone,
  PlusCircle,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const icons = {
  admin: Shield,
  cases: FolderKanban,
  imports: FileInput,
  marketing: Megaphone,
  newCase: PlusCircle,
  notifications: Bell,
  overview: Home,
  reports: BarChart3,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof icons;

type NavLinkProps = {
  href: string;
  iconName: NavIconName;
  label: string;
};

export function NavLink({ href, iconName, label }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/cases" ? pathname === href || pathname.startsWith("/cases/") : pathname === href;
  const Icon = icons[iconName];

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      href={href}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
