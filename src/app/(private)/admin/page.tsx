import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Адміністрування" description="Місце для майбутнього керування користувачами і доступами." />
      <EmptyState title="Адмінка ще без логіки" description="Перший адміністратор: epkram@gmail.com." />
    </>
  );
}
