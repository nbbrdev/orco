"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EllipsisVertical, GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ItemDraft, ItemErrors, ItemField } from "@/features/quotes/items";
import { cn } from "@/lib/utils";

// Um item do orçamento como cartão editável (NBB-86 P4-A): descrição em cima; quantidade, valor e o
// total da linha embaixo. A alça (⠿) arrasta para reordenar (R2-B) e o menu "⋯" tem o Remover
// (R3-A); na NBB-88, o menu ganha o desconto do item.

export function QuoteItemCard({
  item,
  index,
  errors,
  lineTotal,
  onChange,
  onRemove,
}: {
  item: ItemDraft;
  /** Posição na lista, começando em 0. Na tela aparece como "item 1", "item 2"… */
  index: number;
  errors: ItemErrors;
  /** Total da linha já formatado, ou vazio se a linha ainda não tem valor válido. */
  lineTotal: string;
  onChange: (field: ItemField, value: string) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const label = `item ${index + 1}`;
  const errorId = (field: ItemField) => `item-${item.id}-${field}-error`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={`Item ${index + 1}`}
      className={cn(
        "flex gap-2 rounded-lg border border-border bg-background p-3",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastar o ${label} para reordenar`}
        className="flex w-6 shrink-0 cursor-grab touch-none items-start justify-center pt-2 text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-start">
        <Field error={errors.description} errorId={errorId("description")} className="md:flex-1">
          <Input
            aria-label={`Descrição do ${label}`}
            placeholder="Descrição"
            value={item.description}
            onChange={(event) => onChange("description", event.target.value)}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? errorId("description") : undefined}
          />
        </Field>
        <div className="flex items-start gap-2">
          <Field error={errors.quantity} errorId={errorId("quantity")} className="w-16">
            <Input
              aria-label={`Quantidade do ${label}`}
              inputMode="decimal"
              value={item.quantity}
              onChange={(event) => onChange("quantity", event.target.value)}
              aria-invalid={!!errors.quantity}
              aria-describedby={errors.quantity ? errorId("quantity") : undefined}
            />
          </Field>
          <span className="pt-1.5 text-muted-foreground" aria-hidden="true">
            ×
          </span>
          <Field
            error={errors.unitPrice}
            errorId={errorId("unitPrice")}
            className="flex-1 md:w-32 md:flex-none"
          >
            <Input
              aria-label={`Valor do ${label} (R$)`}
              inputMode="decimal"
              placeholder="0,00"
              value={item.unitPrice}
              onChange={(event) => onChange("unitPrice", event.target.value)}
              aria-invalid={!!errors.unitPrice}
              aria-describedby={errors.unitPrice ? errorId("unitPrice") : undefined}
            />
          </Field>
        </div>
        {/* No celular, o total da linha fica embaixo, à direita; no computador, na mesma linha. */}
        <p className="text-right text-sm font-medium tabular-nums md:w-28 md:pt-1.5">
          <span className="sr-only">Total do {label}: </span>
          {lineTotal}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Ações do ${label}`}>
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2 aria-hidden="true" />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function Field({
  error,
  errorId,
  className,
  children,
}: {
  error: string | undefined;
  errorId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {children}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
