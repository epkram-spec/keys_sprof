import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";

type CaseDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CaseDetailsPage({ params }: CaseDetailsPageProps) {
  const { id } = await params;

  return (
    <>
      <PageHeader title="Картка кейсу" description={`Технічний ідентифікатор: ${id}`} />
      <EmptyState title="Дані ще не підключені" description="Бізнес-логіка зʼявиться на наступних Gate-етапах." />
    </>
  );
}
