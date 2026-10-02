"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestRecoveryAction } from "@/features/auth/actions";
import { type RecoveryInput, recoverySchema } from "@/features/auth/schemas";

// "Esqueci minha senha" (F-04): 1 campo. A resposta é sempre a mesma, exista ou não a conta.
export function RecoveryForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RecoveryInput>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: "" },
  });
  const { errors } = form.formState;

  function onSubmit(values: RecoveryInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await requestRecoveryAction(values);
      if (result.status === "sent") {
        setSent(true);
      } else {
        setServerError(result.message);
      }
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6" role="status">
        <p>
          Se existir uma conta com este e-mail, enviamos um link para criar uma senha nova. Ele vale
          por 1 hora.
        </p>
        <Link
          href="/entrar"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Voltar para o login
        </Link>
      </div>
    );
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
      </FieldGroup>

      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enviando…" : "Enviar"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Lembrou?{" "}
        <Link
          href="/entrar"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  );
}
