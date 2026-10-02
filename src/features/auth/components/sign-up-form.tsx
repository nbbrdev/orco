"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/features/auth/actions";
import { PasswordHint } from "@/features/auth/components/password-hint";
import { ResendButton } from "@/features/auth/components/resend-button";
import { type SignUpInput, signUpSchema } from "@/features/auth/schemas";

// Cadastro com e-mail e senha (F-01): 2 campos obrigatórios. A proteção contra robôs (RN-46) não
// aparece para a pessoa: o campo "website" fica escondido e a checagem acontece no servidor.
export function SignUpForm() {
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", website: "" },
  });
  // useWatch (e não form.watch): compatível com o React Compiler.
  const passwordLength = useWatch({ control: form.control, name: "password" }).length;

  function onSubmit(values: SignUpInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (result.status === "sent") {
        setSentTo(result.email);
      } else {
        setServerError(result.message);
      }
    });
  }

  if (sentTo) {
    // Mesma resposta para conta nova, e-mail já cadastrado ou robô (D3): não revela quem usa o Orçô.
    return (
      <div className="flex flex-col gap-6" role="status">
        <p>
          Se este e-mail puder ser usado, enviamos um link para <strong>{sentTo}</strong>. Abra-o
          para ativar sua conta.
        </p>
        <ResendButton email={sentTo} />
      </div>
    );
  }

  const { errors } = form.formState;

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

      {/* Campo "isca" (honeypot, RN-46): fora da tela, fora do Tab e ignorado por leitores de tela e
          gerenciadores de senha. Pessoas nunca o preenchem; robôs costumam preencher tudo. */}
      <div
        aria-hidden="true"
        className="absolute top-auto -left-[10000px] h-px w-px overflow-hidden"
      >
        <label htmlFor="website">Site</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.register("website")}
        />
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
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
