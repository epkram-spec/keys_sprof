import { PageHeader } from "@/components/layout/page-header";
import { CaseForm } from "@/components/cases/case-form";
import type { DirectoryOption } from "@/lib/cases/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NewCasePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  required: "Заповніть обовʼязкові поля.",
  create: "Не вдалося додати кейс. Перевірте дані й спробуйте ще раз.",
};

export default async function NewCasePage({ searchParams }: NewCasePageProps) {
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const [{ data: segments }, { data: cities }] = await Promise.all([
    supabase.from("case_segments").select("id,name").order("sort_order"),
    supabase.from("cities").select("id,name").order("sort_order"),
  ]);

  return (
    <>
      <PageHeader title="Додати кейс" description="Обовʼязкові поля розміщені зверху, додатковий контекст - нижче." />
      {params.error ? (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessages[params.error] ?? "Сталася помилка. Спробуйте ще раз."}
        </p>
      ) : null}
      <CaseForm
        cities={(cities ?? []) as DirectoryOption[]}
        mode="create"
        segments={(segments ?? []) as DirectoryOption[]}
      />
    </>
  );
}
