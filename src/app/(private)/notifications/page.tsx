import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Сповіщення" description="Усі сповіщення кабінету будуть зібрані тут." />
      <EmptyState title="Сповіщень немає" description="Логіка дзвіночка буде додана окремим Gate-етапом." />
    </>
  );
}
