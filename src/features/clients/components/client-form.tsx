"use client";

import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteClientAction, saveClientAction } from "@/features/clients/actions";
import type { ClientField, ClientRow } from "@/features/clients/schemas";
import { formatDocument } from "@/lib/document";

// Formulário do cliente no painel (F-15, NBB-44): só o nome é obrigatório (RN-07) e nada é gravado
// até tocar em Salvar (K6-A). Na edição, o Excluir pede confirmação (K7-A).

type Draft = Record<ClientField, string>;

function toDraft(client: ClientRow | null): Draft {
  return {
    name: client?.name ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    document: client?.document ? formatDocument(client.document) : "",
    address: client?.address ?? "",
    internalNotes: client?.internalNotes ?? "",
  };
}

export function ClientForm({
  client,
  onSaved,
  onDeleted,
}: {
  /** Cliente em edição, ou `null` para um novo. */
  client: ClientRow | null;
  onSaved: (client: ClientRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(client));
  const [errors, setErrors] = useState<Partial<Record<ClientField, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveClientAction(client?.id ?? null, draft);
      setErrors(result.status === "invalid" ? result.errors : {});
      if (result.status === "saved") {
        setMessage(null);
        onSaved(result.client);
      } else if (result.status === "limit" || result.status === "error") {
        setMessage(result.message);
      } else if (result.status === "not_found") {
        setMessage("Este cliente não existe mais. Feche o painel e atualize a página.");
      } else {
        setMessage(null);
      }
    });
  }

  function remove() {
    if (!client) return;
    startTransition(async () => {
      const result = await deleteClientAction(client.id);
      if (result.status === "error") {
        setMessage(result.message);
      } else {
        onDeleted(client.id);
      }
    });
  }

  function field(name: ClientField) {
    return {
      id: `client-${name}`,
      value: draft[name],
      "aria-invalid": !!errors[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft((current) => ({ ...current, [name]: event.target.value })),
    };
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="client-name">Nome</FieldLabel>
          <Input {...field("name")} autoComplete="off" required />
          {errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="client-email">E-mail</FieldLabel>
          <Input {...field("email")} type="email" inputMode="email" autoComplete="off" />
          {errors.email ? <FieldError>{errors.email}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="client-phone">Telefone</FieldLabel>
          <Input
            {...field("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(11) 91234-5678"
          />
          {errors.phone ? <FieldError>{errors.phone}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.document}>
          <FieldLabel htmlFor="client-document">CPF ou CNPJ</FieldLabel>
          <Input {...field("document")} autoComplete="off" />
          {errors.document ? <FieldError>{errors.document}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.address}>
          <FieldLabel htmlFor="client-address">Endereço</FieldLabel>
          <Textarea {...field("address")} rows={2} />
          {errors.address ? <FieldError>{errors.address}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.internalNotes}>
          <FieldLabel htmlFor="client-internalNotes">Observações internas</FieldLabel>
          <Textarea
            {...field("internalNotes")}
            rows={3}
            aria-describedby="client-internalNotes-description"
          />
          <FieldDescription id="client-internalNotes-description">
            Só você vê. Nunca aparecem no orçamento.
          </FieldDescription>
          {errors.internalNotes ? <FieldError>{errors.internalNotes}</FieldError> : null}
        </Field>
      </FieldGroup>

      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        {client ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" className="text-destructive" disabled={pending}>
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {client.name}?</AlertDialogTitle>
                <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </form>
  );
}
