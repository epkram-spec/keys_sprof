import { env } from "@/env";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
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

        <form className="space-y-4">
          <label className="block text-sm font-medium">
            Електронна пошта
            <input
              className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="name@sprof.ua"
              type="email"
            />
          </label>
          <label className="block text-sm font-medium">
            Пароль
            <input
              className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="Введіть пароль"
              type="password"
            />
          </label>
          <Button className="w-full" type="button">
            Увійти
          </Button>
        </form>
      </section>
    </main>
  );
}
