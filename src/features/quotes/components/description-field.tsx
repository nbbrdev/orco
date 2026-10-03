"use client";

import { Command as CommandPrimitive } from "cmdk";
import { useState } from "react";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { type CatalogSuggestion, suggestFromCatalog } from "@/features/quotes/items";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

// Descrição do item com sugestões do catálogo (F-05, RF-15, NBB-87 C6-A): enquanto a pessoa digita,
// aparecem os itens do catálogo com nome parecido (sem acentos). Escolher um preenche descrição,
// unidade e valor; dá para ignorar e continuar digitando. Setas e Enter escolhem pelo teclado.

// O mesmo visual do <Input> do shadcn.
const INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

export function DescriptionField({
  value,
  label,
  catalog,
  invalid,
  describedBy,
  onChange,
  onPick,
}: {
  value: string;
  label: string;
  catalog: readonly CatalogSuggestion[];
  invalid: boolean;
  describedBy: string | undefined;
  onChange: (value: string) => void;
  onPick: (suggestion: CatalogSuggestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = suggestFromCatalog(catalog, value);

  return (
    // O `label` vira o <label> que o cmdk liga ao campo: é o nome que o leitor de tela anuncia.
    <Command
      label={label}
      shouldFilter={false}
      className="overflow-visible rounded-none! bg-transparent p-0"
    >
      <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <CommandPrimitive.Input
            placeholder="Descrição"
            value={value}
            onValueChange={(next) => {
              onChange(next);
              setOpen(true);
            }}
            onBlur={() => setOpen(false)}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn(INPUT_CLASS)}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-64 p-1"
          // O foco fica no campo, para continuar digitando.
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <CommandList>
            <CommandGroup heading="Do catálogo">
              {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.id}
                  value={suggestion.id}
                  // Sem isso, o clique tira o foco do campo e fecha a lista antes de escolher.
                  onMouseDown={(event) => event.preventDefault()}
                  onSelect={() => {
                    onPick(suggestion);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{suggestion.name}</span>
                  {suggestion.unitPriceCents === null ? null : (
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {formatBRL(suggestion.unitPriceCents)}
                      {suggestion.unit ? ` / ${suggestion.unit}` : ""}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  );
}
