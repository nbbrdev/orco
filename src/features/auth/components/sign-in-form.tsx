"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type SignInState, signInAction } from "@/features/auth/actions";
import { ResendButton } from "@/features/auth/components/resend-button";
import { type SignInInput, signInSchema } from "@/features/auth/schemas";

// Entrar com e-mail e senha (F-03): 2 campos. Em caso de sucesso, a Server Action redireciona.
export function SignInForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SignInState | null>(null);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  function onSubmit(values: SignInInput) {
    setResult(null);
    startTransition(async () => {
      setResult(await signInAction(values));
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>

      {result ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-destructive">
            {result.message}
          </p>
          {result.status === "unverified" ? <ResendButton email={result.email} /> : null}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Criar conta grátis
        </Link>
      </p>
    </form>
  );
}
