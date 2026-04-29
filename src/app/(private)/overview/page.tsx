import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";

export default function OverviewPage() {
  return (
    <>
      <PageHeader
        title="Огляд"
        description="Короткий стан потенційних кейсів і підготовки до передачі в маркетинг."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Нові кейси" value="0" />
        <StatCard label="Очікують оцінки" value="0" />
        <StatCard label="Передано в маркетинг" value="0" />
      </div>
    </>
  );
}
