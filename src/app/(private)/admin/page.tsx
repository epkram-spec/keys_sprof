import {
  archiveCaseAction,
  createUserAction,
  updateUserRoleAction,
  upsertCityAction,
  upsertSegmentAction,
} from "@/app/(private)/admin/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/ui/info-hint";
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
        description="Стисла панель для користувачів, довідників, архіву і системних журналів. Пояснення відкриваються через значок поруч із короткими назвами."
      />

      <section className="mb-6 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Створення користувача
          <InfoHint label="Реєстрація з інтерфейсу закрита. Користувач створюється в Supabase Authentication, а роль виставляється тут." />
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Адміністратор може створити користувача тут. Він одразу потрапить у Supabase Auth і в таблицю profiles.
        </p>
        <form action={createUserAction} className="mt-4 grid min-w-0 gap-3 rounded-md border bg-background p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(160px,0.7fr)]">
          <input className="h-10 min-w-0 rounded-md border bg-card px-3" name="email" placeholder="email@sprof.ua" required type="email" />
          <input className="h-10 min-w-0 rounded-md border bg-card px-3" minLength={8} name="password" placeholder="Тимчасовий пароль" required type="text" />
          <input className="h-10 min-w-0 rounded-md border bg-card px-3" name="displayName" placeholder="Імʼя" />
          <select className="h-10 min-w-0 rounded-md border bg-card px-3" defaultValue="manager" name="role">
            {(["manager", "marketing", "leader", "admin"] as AppRole[]).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
          <label className="flex min-h-10 items-center gap-2 text-sm font-medium xl:col-span-2">
            <input defaultChecked name="isActive" type="checkbox" />
            Активний
          </label>
          <Button className="w-full sm:w-auto xl:justify-self-end" type="submit">Створити</Button>
        </form>
      </section>

      <section className="mb-6 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Користувачі
          <InfoHint label="Роль визначає меню і доступ: менеджер бачить свої кейси, маркетинг працює зі статусами, керівник бачить зведення, адміністратор керує системою." />
        </h2>
        <div className="mt-4 space-y-3">
          {((users ?? []) as ProfileRow[]).map((user) => (
            <form className="grid min-w-0 gap-3 rounded-md border bg-background p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(160px,0.8fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(170px,0.8fr)_auto_auto]" action={updateUserRoleAction} key={user.id}>
              <input name="userId" type="hidden" value={user.id} />
              <div className="min-w-0">
                <p className="break-words font-medium">{user.display_name ?? user.email}</p>
                <p className="break-words text-xs text-muted-foreground">{user.email}</p>
              </div>
              <label className="text-sm font-medium">
                Роль
                <select className="mt-2 h-10 w-full min-w-0 rounded-md border bg-card px-3" defaultValue={user.role} name="role">
                  {(["manager", "marketing", "leader", "admin"] as AppRole[]).map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                <input defaultChecked={user.is_active} name="isActive" type="checkbox" />
                Активний
              </label>
              <Button className="w-full sm:w-auto" type="submit" variant="secondary">Зберегти</Button>
            </form>
          ))}
        </div>
      </section>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <DirectoryPanel action={upsertSegmentAction} hint="Сегмент допомагає фільтрувати кейси за ринком або напрямом клієнта." items={(segments ?? []) as DirectoryRow[]} title="Сегменти" />
        <DirectoryPanel action={upsertCityAction} hint="Місто використовується у фільтрах, звітах і плануванні зйомки." items={(cities ?? []) as DirectoryRow[]} title="Міста" />
      </div>

      <section className="mb-6 rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Архів кейсів
          <InfoHint label="Архів прибирає кейс з робочих списків, але не видаляє його з бази." />
        </h2>
        <div className="mt-4 space-y-3">
          {((cases ?? []) as unknown as CaseAdminRow[]).map((caseItem) => (
            <form className="flex min-w-0 flex-col gap-3 rounded-md border bg-background p-3 md:flex-row md:items-center md:justify-between" action={archiveCaseAction} key={caseItem.id}>
              <input name="caseId" type="hidden" value={caseItem.id} />
              <div className="min-w-0">
                <p className="break-words font-medium">{caseItem.title}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {caseItem.owner?.display_name ?? caseItem.owner?.email ?? "Невідомо"} · оновлено {formatDateTime(caseItem.updated_at)}
                </p>
              </div>
              <Button className="w-full shrink-0 sm:w-auto" type="submit" variant="outline">Архівувати</Button>
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
  hint,
  items,
  title,
}: {
  action: (formData: FormData) => Promise<void>;
  hint: string;
  items: DirectoryRow[];
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {title}
        <InfoHint label={hint} />
      </h2>
      <form action={action} className="mt-4 grid min-w-0 gap-3 rounded-md border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_100px] xl:grid-cols-[minmax(0,1fr)_100px_auto]">
        <input className="h-10 min-w-0 rounded-md border bg-card px-3" name="name" placeholder="Нова назва" />
        <input className="h-10 min-w-0 rounded-md border bg-card px-3" name="sortOrder" placeholder="Порядок" type="number" />
        <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
          <input defaultChecked name="isActive" type="checkbox" />
          Активний
        </label>
        <div className="sm:col-span-2 xl:col-span-3">
          <Button className="w-full sm:w-auto" type="submit">Додати</Button>
        </div>
      </form>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <form action={action} className="grid min-w-0 gap-2 rounded-md border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_100px] xl:grid-cols-[minmax(0,1fr)_100px_auto_auto]" key={item.id}>
            <input name="id" type="hidden" value={item.id} />
            <input className="h-10 min-w-0 rounded-md border bg-card px-3" defaultValue={item.name} name="name" />
            <input className="h-10 min-w-0 rounded-md border bg-card px-3" defaultValue={item.sort_order} name="sortOrder" type="number" />
            <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
              <input defaultChecked={item.is_active} name="isActive" type="checkbox" />
              Активний
            </label>
            <Button className="w-full sm:w-auto" type="submit" variant="secondary">Зберегти</Button>
          </form>
        ))}
      </div>
    </section>
  );
}

function LogPanel({ activity }: { activity: ActivityRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        Журнал важливих дій
        <InfoHint label="Тут видно службові зміни: ролі, довідники, архів, статуси маркетингу, імпорт і файли." />
      </h2>
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
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        Системні сповіщення
        <InfoHint label="Тут збираються критичні події: помилки доставки, імпорту та гарячі кейси." />
      </h2>
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
