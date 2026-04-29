import {
  archiveCaseAction,
  updateUserRoleAction,
  upsertCityAction,
  upsertSegmentAction,
} from "@/app/(private)/admin/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import type { AppRole } from "@/lib/auth/types";
import { roleLabels } from "@/lib/auth/types";
import { formatDateTime } from "@/lib/cases/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  email: string;
  role: AppRole;
  display_name: string | null;
  is_active: boolean;
};

type DirectoryRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type CaseAdminRow = {
  id: string;
  title: string;
  owner?: { email: string; display_name: string | null } | null;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: { email: string; display_name: string | null } | null;
};

type NotificationEventRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const [
    { data: users },
    { data: segments },
    { data: cities },
    { data: cases },
    { data: activity },
    { data: systemEvents },
  ] = await Promise.all([
    supabase.from("profiles").select("id,email,role,display_name,is_active").order("email"),
    supabase.from("case_segments").select("id,name,sort_order,is_active").order("sort_order"),
    supabase.from("cities").select("id,name,sort_order,is_active").order("sort_order"),
    supabase
      .from("cases")
      .select("id,title,updated_at,owner:profiles!cases_owner_user_id_fkey(email,display_name)")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("case_activity_log")
      .select("id,action,metadata,created_at,actor:profiles!case_activity_log_actor_user_id_fkey(email,display_name)")
      .in("action", [
        "admin.user_role_updated",
        "admin.segment_saved",
        "admin.city_saved",
        "admin.case_archived",
        "marketing.status_changed",
        "google_sheet_import.imported",
        "file.uploaded",
      ])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notification_events")
      .select("id,type,title,body,metadata,created_at")
      .in("type", ["notification_delivery_failed", "google_sheet_import_error", "case_hot"])
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <PageHeader
        title="Адміністрування"
        description="Мінімальна панель для користувачів, довідників, архіву і системних журналів."
      />

      <section className="mb-6 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Створення користувача</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Реєстрація з інтерфейсу закрита. Створюй користувача в Supabase Dashboard у розділі Authentication, Users, Add user.
          Після створення перевір запис у `profiles` і вистав роль тут. Перший адміністратор: epkram@gmail.com.
        </p>
      </section>

      <section className="mb-6 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Користувачі</h2>
        <div className="mt-4 space-y-3">
          {((users ?? []) as ProfileRow[]).map((user) => (
            <form className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1.2fr_0.8fr_auto_auto]" action={updateUserRoleAction} key={user.id}>
              <input name="userId" type="hidden" value={user.id} />
              <div>
                <p className="font-medium">{user.display_name ?? user.email}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <select className="h-10 rounded-md border bg-card px-3" defaultValue={user.role} name="role">
                {(["manager", "marketing", "leader", "admin"] as AppRole[]).map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input defaultChecked={user.is_active} name="isActive" type="checkbox" />
                Активний
              </label>
              <Button type="submit" variant="secondary">Зберегти</Button>
            </form>
          ))}
        </div>
      </section>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <DirectoryPanel action={upsertSegmentAction} items={(segments ?? []) as DirectoryRow[]} title="Сегменти" />
        <DirectoryPanel action={upsertCityAction} items={(cities ?? []) as DirectoryRow[]} title="Міста" />
      </div>

      <section className="mb-6 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">Архів кейсів</h2>
        <div className="mt-4 space-y-3">
          {((cases ?? []) as unknown as CaseAdminRow[]).map((caseItem) => (
            <form className="flex flex-col gap-3 rounded-md border bg-background p-3 md:flex-row md:items-center md:justify-between" action={archiveCaseAction} key={caseItem.id}>
              <input name="caseId" type="hidden" value={caseItem.id} />
              <div>
                <p className="font-medium">{caseItem.title}</p>
                <p className="text-xs text-muted-foreground">
                  {caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо"} · оновлено {formatDateTime(caseItem.updated_at)}
                </p>
              </div>
              <Button type="submit" variant="outline">Архівувати</Button>
            </form>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <LogPanel activity={(activity ?? []) as unknown as ActivityRow[]} />
        <SystemNotificationsPanel events={(systemEvents ?? []) as NotificationEventRow[]} />
      </div>
    </>
  );
}

function DirectoryPanel({
  action,
  items,
  title,
}: {
  action: (formData: FormData) => Promise<void>;
  items: DirectoryRow[];
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <form action={action} className="mt-4 grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1fr_100px_auto]">
        <input className="h-10 rounded-md border bg-card px-3" name="name" placeholder="Нова назва" />
        <input className="h-10 rounded-md border bg-card px-3" name="sortOrder" placeholder="Порядок" type="number" />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input defaultChecked name="isActive" type="checkbox" />
          Активний
        </label>
        <div className="md:col-span-3">
          <Button type="submit">Додати</Button>
        </div>
      </form>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <form action={action} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[1fr_100px_auto_auto]" key={item.id}>
            <input name="id" type="hidden" value={item.id} />
            <input className="h-10 rounded-md border bg-card px-3" defaultValue={item.name} name="name" />
            <input className="h-10 rounded-md border bg-card px-3" defaultValue={item.sort_order} name="sortOrder" type="number" />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input defaultChecked={item.is_active} name="isActive" type="checkbox" />
              Активний
            </label>
            <Button type="submit" variant="secondary">Зберегти</Button>
          </form>
        ))}
      </div>
    </section>
  );
}

function LogPanel({ activity }: { activity: ActivityRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Журнал важливих дій</h2>
      <div className="mt-4 space-y-3">
        {activity.length ? activity.map((item) => (
          <article className="rounded-md border bg-background p-3" key={item.id}>
            <p className="font-medium">{item.action}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.actor?.display_name ?? item.actor?.email ?? "Система"} · {formatDateTime(item.created_at)}
            </p>
          </article>
        )) : <p className="text-sm text-muted-foreground">Записів ще немає.</p>}
      </div>
    </section>
  );
}

function SystemNotificationsPanel({ events }: { events: NotificationEventRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-lg font-semibold">Системні сповіщення і помилки доставки</h2>
      <div className="mt-4 space-y-3">
        {events.length ? events.map((event) => (
          <article className="rounded-md border bg-background p-3" key={event.id}>
            <p className="font-medium">{event.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{event.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{event.type} · {formatDateTime(event.created_at)}</p>
          </article>
        )) : <p className="text-sm text-muted-foreground">Системних записів ще немає.</p>}
      </div>
    </section>
  );
}
