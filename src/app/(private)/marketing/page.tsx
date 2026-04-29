import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function MarketingPage() {
  return (
    <>
      <PageHeader title="Маркетинг" description="Панель для кейсів, які передаються в маркетинг." />
      <EmptyState title="Передач ще немає" description="Поки що це сторінка-заготовка без логіки." />
    </>
  );
}
