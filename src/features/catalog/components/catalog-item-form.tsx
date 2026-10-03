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
import { deleteCatalogItemAction, saveCatalogItemAction } from "@/features/catalog/actions";
import { priceToInput } from "@/features/catalog/price";
import type { CatalogItemField, CatalogItemRow } from "@/features/catalog/schemas";

// Formulário do item no painel (F-16, NBB-45), no mesmo padrão dos clientes: só o nome é
// obrigatório (RN-10) e nada é gravado até tocar em Salvar. Na edição, o Excluir pede confirmação.

type Draft = Record<CatalogItemField, string>;

function toDraft(item: CatalogItemRow | null): Draft {
  return {
    name: item?.name ?? "",
    unit: item?.unit ?? "",
    unitPrice: priceToInput(item?.unitPriceCents ?? null),
  };
}

export function CatalogItemForm({
  item,
  onSaved,
  onDeleted,
}: {
  /** Item em edição, ou `null` para um novo. */
  item: CatalogItemRow | null;
  onSaved: (item: CatalogItemRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(item));
  const [errors, setErrors] = useState<Partial<Record<CatalogItemField, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveCatalogItemAction(item?.id ?? null, draft);
      setErrors(result.status === "invalid" ? result.errors : {});
      if (result.status === "saved") {
        setMessage(null);
        onSaved(result.item);
      } else if (result.status === "limit" || result.status === "error") {
        setMessage(result.message);
      } else if (result.status === "not_found") {
        setMessage("Este item não existe mais. Feche o painel e atualize a página.");
      } else {
        setMessage(null);
      }
    });
  }

  function remove() {
    if (!item) return;
    startTransition(async () => {
      const result = await deleteCatalogItemAction(item.id);
      if (result.status === "error") {
        setMessage(result.message);
      } else {
        onDeleted(item.id);
      }
    });
  }

  function field(name: CatalogItemField) {
    return {
      id: `catalog-${name}`,
      value: draft[name],
      "aria-invalid": !!errors[name],
      autoComplete: "off",
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((current) => ({ ...current, [name]: event.target.value })),
    };
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="catalog-name">Nome</FieldLabel>
          <Input {...field("name")} required />
          {errors.name ? <FieldError>{errors.name}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.unitPrice}>
          <FieldLabel htmlFor="catalog-unitPrice">Preço (R$)</FieldLabel>
          <Input
            {...field("unitPrice")}
            inputMode="decimal"
            placeholder="0,00"
            aria-describedby="catalog-unitPrice-description"
          />
          <FieldDescription id="catalog-unitPrice-description">
            Opcional. Sem preço, você preenche no orçamento.
          </FieldDescription>
          {errors.unitPrice ? <FieldError>{errors.unitPrice}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.unit}>
          <FieldLabel htmlFor="catalog-unit">Unidade</FieldLabel>
          <Input {...field("unit")} placeholder="h, un, m²" />
          {errors.unit ? <FieldError>{errors.unit}</FieldError> : null}
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
        {item ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" className="text-destructive" disabled={pending}>
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {item.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Os orçamentos que já usam este item não mudam.
                </AlertDialogDescription>
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
