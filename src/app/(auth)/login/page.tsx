import { env } from "@/env";
import { LoginForm } from "@/app/(auth)/login/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const pageError = params.error === "inactive" ? "Ваш обліковий запис деактивовано." : undefined;

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-[420px] rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">Внутрішній сервіс</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">{env.NEXT_PUBLIC_APP_NAME}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Вхід до кабінету для роботи з потенційними кейсами SPROF.
          </p>
        </div>

        <LoginForm pageError={pageError} />
      </section>
    </main>
  );
}
