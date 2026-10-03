"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CatalogItemForm } from "@/features/catalog/components/catalog-item-form";
import { describePrice } from "@/features/catalog/price";
import type { CatalogItemRow } from "@/features/catalog/schemas";
import { searchCatalogItems } from "@/features/catalog/search";
import { useMediaQuery } from "@/hooks/use-media-query";

// Catálogo (F-16, NBB-45), no mesmo padrão da lista de clientes: todos os itens chegam de uma vez e
// a busca filtra aqui; novo e editar abrem o mesmo painel (lateral no computador, de baixo no
// celular).

const byName = (a: CatalogItemRow, b: CatalogItemRow) => a.name.localeCompare(b.name, "pt-BR");

/** Painel aberto: `null` fechado, "new" para um item novo, ou o item em edição. */
type Panel = null | "new" | CatalogItemRow;

export function CatalogList({ initial }: { initial: CatalogItemRow[] }) {
  const [list, setList] = useState(initial);
  const [term, setTerm] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const wide = useMediaQuery("(min-width: 640px)");

  const editing = panel !== null && panel !== "new" ? panel : null;
  const found = searchCatalogItems(list, term);

  function onSaved(item: CatalogItemRow) {
    setList((current) => [...current.filter((other) => other.id !== item.id), item].sort(byName));
    setPanel(null);
  }

  function onDeleted(id: string) {
    setList((current) => current.filter((item) => item.id !== id));
    setPanel(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Catálogo</h1>
        <Button type="button" onClick={() => setPanel("new")}>
          <Plus aria-hidden="true" />
          Novo item
        </Button>
      </div>

      {list.length === 0 ? (
        // I5-B: a frase "Você também pode salvá-los direto do orçamento." volta com o editor (NBB-47).
        <p className="text-muted-foreground">
          Itens que você usa sempre ficam aqui. Toque em Novo item para cadastrar o primeiro.
        </p>
      ) : (
        <>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Buscar no catálogo"
              placeholder="Buscar pelo nome"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="pl-9"
            />
          </div>

          {found.length === 0 ? (
            <p className="text-muted-foreground">Nenhum item encontrado.</p>
          ) : (
            <ul aria-label="Itens do catálogo" className="flex flex-col divide-y rounded-lg border">
              {found.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setPanel(item)}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {describePrice(item)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent
          side={wide ? "right" : "bottom"}
          className="overflow-y-auto data-[side=bottom]:max-h-[90dvh] data-[side=right]:sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>{editing ? "Editar item" : "Novo item"}</SheetTitle>
            <SheetDescription>Só o nome é obrigatório.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {panel !== null ? (
              <CatalogItemForm
                key={editing?.id ?? "new"}
                item={editing}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
