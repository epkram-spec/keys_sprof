import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Налаштування" description="Базові налаштування профілю та каналів сповіщень." />
      <EmptyState title="Налаштування ще не активні" description="На цьому Gate додано тільки маршрут і оболонку." />
    </>
  );
}
