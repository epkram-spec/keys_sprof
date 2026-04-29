"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { loginAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

export function LoginForm({ pageError }: { pageError?: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, {});
  const error = state.error ?? pageError;

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-medium">
        Електронна пошта
        <input
          autoComplete="email"
          className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"
          name="email"
          placeholder="name@sprof.ua"
          required
          type="email"
        />
      </label>
      <label className="block text-sm font-medium">
        Пароль
        <input
          autoComplete="current-password"
          className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"
          name="password"
          placeholder="Введіть пароль"
          required
          type="password"
        />
      </label>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Увійти
      </Button>
    </form>
  );
}
