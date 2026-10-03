"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteAccountAction } from "@/features/auth/actions";

// Excluir a conta (F-17, RN-06, NBB-43 E4): na própria seção Conta do perfil. O botão final só fica
// ativo com "EXCLUIR" digitado exatamente assim; o servidor confere de novo.

const CONFIRMATION = "EXCLUIR";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div>
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          Excluir minha conta
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-destructive/40 p-4">
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Excluir a conta apaga para sempre:</p>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>seu perfil e seu logo;</li>
          <li>seus clientes e seu catálogo;</li>
          <li>todos os orçamentos e o histórico de respostas.</li>
        </ul>
        <p className="text-muted-foreground">
          Os links de orçamento que você enviou deixam de funcionar. Não dá para desfazer.
        </p>
      </div>

      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="delete-confirmation">Digite EXCLUIR para confirmar</FieldLabel>
        <Input
          id="delete-confirmation"
          value={typed}
          autoComplete="off"
          autoCapitalize="characters"
          onChange={(event) => setTyped(event.target.value)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={typed !== CONFIRMATION || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAccountAction(typed);
              setError(result.message);
            })
          }
        >
          {pending ? "Excluindo…" : "Excluir conta definitivamente"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
