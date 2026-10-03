"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { OptionsDraft, OptionsErrors } from "@/features/quotes/items";
import { todayInAppTimeZone } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { DiscountInput } from "./discount-input";

// "Mais opções" do orçamento (NBB-88 G2-A): fechado por padrão, para o fluxo principal continuar só
// cliente → itens → total. Abre sozinho se algum campo daqui precisar de correção.

type TextField = "paymentTerms" | "deliveryTime" | "notes" | "internalNotes";

const TEXT_FIELDS: { field: TextField; label: string; description?: string; rows: number }[] = [
  { field: "paymentTerms", label: "Condições de pagamento", rows: 2 },
  { field: "deliveryTime", label: "Prazo de execução", rows: 2 },
  { field: "notes", label: "Observações", description: "O cliente vê.", rows: 3 },
  {
    field: "internalNotes",
    label: "Anotações internas",
    description: "Só você vê. Nunca aparecem no orçamento.",
    rows: 3,
  },
];

export function MoreOptions({
  options,
  errors,
  discountHint,
  onChange,
}: {
  options: OptionsDraft;
  errors: OptionsErrors;
  /** Aviso embaixo do desconto geral, ex.: quando ele foi limitado ao subtotal (G6-A). */
  discountHint?: string;
  onChange: (options: OptionsDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const expanded = open || Object.keys(errors).length > 0;
  const pastDate = !errors.validUntil && options.validUntil < todayInAppTimeZone();

  function change<K extends keyof OptionsDraft>(field: K, value: OptionsDraft[K]) {
    onChange({ ...options, [field]: value });
  }

  return (
    <section aria-label="Mais opções" className="flex flex-col gap-4">
      <div>
        <Button
          type="button"
          variant="ghost"
          className="-ml-2.5"
          aria-expanded={expanded}
          aria-controls="quote-more-options"
          onClick={() => setOpen(!expanded)}
        >
          Mais opções
          <ChevronDown
            aria-hidden="true"
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </Button>
      </div>

      <div id="quote-more-options" hidden={!expanded} className="flex flex-col gap-5">
        <Field data-invalid={!!errors.discount}>
          <FieldLabel htmlFor="quote-discount">Desconto geral</FieldLabel>
          <DiscountInput
            id="quote-discount"
            label="Desconto geral"
            value={options.discount}
            onChange={(discount) => change("discount", discount)}
            invalid={!!errors.discount}
          />
          {errors.discount ? (
            <FieldError>{errors.discount}</FieldError>
          ) : discountHint ? (
            <FieldDescription>{discountHint}</FieldDescription>
          ) : null}
        </Field>

        <Field data-invalid={!!errors.validUntil}>
          <FieldLabel htmlFor="quote-validUntil">Validade</FieldLabel>
          <Input
            id="quote-validUntil"
            type="date"
            required
            value={options.validUntil}
            onChange={(event) => change("validUntil", event.target.value)}
            aria-invalid={!!errors.validUntil}
            className="w-44"
          />
          {errors.validUntil ? (
            <FieldError>{errors.validUntil}</FieldError>
          ) : pastDate ? (
            <FieldDescription>
              Essa data já passou: o orçamento vai aparecer como expirado.
            </FieldDescription>
          ) : null}
        </Field>

        {TEXT_FIELDS.map(({ field, label, description, rows }) => (
          <Field key={field} data-invalid={!!errors[field]}>
            <FieldLabel htmlFor={`quote-${field}`}>{label}</FieldLabel>
            <Textarea
              id={`quote-${field}`}
              rows={rows}
              value={options[field]}
              onChange={(event) => change(field, event.target.value)}
              aria-invalid={!!errors[field]}
            />
            {description ? <FieldDescription>{description}</FieldDescription> : null}
            {errors[field] ? <FieldError>{errors[field]}</FieldError> : null}
          </Field>
        ))}
      </div>
    </section>
  );
}
