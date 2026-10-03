"use client";

import type { Ref } from "react";

import { Input } from "@/components/ui/input";
import type { DiscountDraft, DiscountType } from "@/features/quotes/items";
import { cn } from "@/lib/utils";

// Um desconto (NBB-88 G1-A/G2-A): escolhe % ou R$ e digita o valor. Usado no item e no desconto
// geral. Sem tipo escolhido ainda, começa em %.

const TYPES: { type: DiscountType; text: string; name: string }[] = [
  { type: "percent", text: "%", name: "Percentual" },
  { type: "amount", text: "R$", name: "Valor em reais" },
];

export function DiscountInput({
  id,
  label,
  value,
  onChange,
  invalid,
  describedBy,
  inputRef,
  className,
}: {
  id?: string;
  /** Nome acessível do campo, ex.: "Desconto do item 1". */
  label: string;
  value: DiscountDraft;
  onChange: (value: DiscountDraft) => void;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const type = value.type ?? "percent";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="group"
        aria-label={`Tipo do ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
        className="flex shrink-0 rounded-md border border-input p-0.5"
      >
        {TYPES.map((option) => (
          <button
            key={option.type}
            type="button"
            aria-pressed={type === option.type}
            aria-label={option.name}
            onClick={() => onChange({ type: option.type, value: value.value })}
            className={cn(
              "h-7 min-w-8 rounded-sm px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              type === option.type
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {option.text}
          </button>
        ))}
      </div>
      <Input
        id={id}
        ref={inputRef}
        aria-label={label}
        inputMode="decimal"
        placeholder={type === "percent" ? "0" : "0,00"}
        value={value.value}
        onChange={(event) => onChange({ type, value: event.target.value })}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="w-24"
      />
    </div>
  );
}
