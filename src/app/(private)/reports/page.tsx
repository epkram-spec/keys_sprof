import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Звіти" description="Зведення по кейсах і передачах у маркетинг." />
      <EmptyState title="Звітів ще немає" description="Показники будуть додані після появи бізнес-даних." />
    </>
  );
}
