import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function ImportsPage() {
  return (
    <>
      <PageHeader title="Імпорт" description="Майбутній імпорт даних із Google Sheets." />
      <EmptyState title="Імпорт ще не налаштований" description="Тут буде підключення таблиць без ручного дублювання." />
    </>
  );
}
