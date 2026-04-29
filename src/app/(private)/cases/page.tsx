import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function CasesPage() {
  return (
    <>
      <PageHeader title="Кейси" description="Перелік потенційних кейсів для оцінки та ведення." />
      <EmptyState title="Кейсів ще немає" description="На цьому етапі додано тільки каркас сторінки." />
    </>
  );
}
