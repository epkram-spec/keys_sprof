import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

export default function NewCasePage() {
  return (
    <>
      <PageHeader title="Новий кейс" description="Форма-заготовка для майбутнього створення кейсу." />
      <section className="grid gap-4 rounded-lg border bg-card p-5">
        <label className="text-sm font-medium">
          Назва кейсу
          <input className="mt-2 h-10 w-full rounded-md border bg-background px-3" />
        </label>
        <label className="text-sm font-medium">
          Короткий опис
          <textarea className="mt-2 min-h-28 w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <div>
          <Button type="button">Зберегти чернетку</Button>
        </div>
      </section>
    </>
  );
}
