export type AppRole = "manager" | "marketing" | "leader" | "admin";

export type Profile = {
  id: string;
  email: string;
  role: AppRole;
  display_name: string | null;
  is_active: boolean;
};

export const roleLabels: Record<AppRole, string> = {
  manager: "Менеджер",
  marketing: "Маркетинг",
  leader: "Керівник",
  admin: "Адміністратор",
};
