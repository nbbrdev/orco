"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { resetPasswordAction } from "@/features/auth/actions";
import { PasswordHint } from "@/features/auth/components/password-hint";
import { type ResetPasswordInput, resetPasswordSchema } from "@/features/auth/schemas";

// Nova senha (F-04): 1 campo, com o olho e a dica ao vivo (P10). Em caso de sucesso, a Server Action
// redireciona para o /entrar.
export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "" },
  });
  // useWatch (e não form.watch): compatível com o React Compiler.
  const passwordLength = useWatch({ control: form.control, name: "password" }).length;
  const { errors } = form.formState;

  function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      setServerError(result.message);
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Nova senha</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-hint"
            {...form.register("password")}
          />
          <PasswordHint id="password-hint" length={passwordLength} />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>

      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
