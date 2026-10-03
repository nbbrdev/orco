"use client";

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { saveQuoteItemsAction } from "@/features/quotes/actions";
import {
  formatQuoteNumber,
  type ItemDraft,
  type ItemErrors,
  type ItemField,
  itemsTotal,
  lineTotals,
  newItemDraft,
  type ParsedItem,
  parseItem,
} from "@/features/quotes/items";
import { MAX_ITEMS_PER_QUOTE } from "@/lib/db/schema/quote-limits";
import { formatBRL } from "@/lib/money";

import { QuoteItemCard } from "./quote-item-card";

// Editor de orçamento, parte 1 (F-05, NBB-86): itens, total na hora e salvamento automático.
// - Cada mudança agenda um salvamento do orçamento inteiro ~800 ms depois (P2-A, RN-21). Se algum
//   campo estiver inválido, nada é salvo até corrigir (P3-A).
// - Reordenar arrastando pela alça (R2-B), também pelo teclado (espaço, setas, espaço).

const SAVE_DELAY_MS = 800;

type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "error" | "blocked";

export function QuoteEditor({
  quoteId,
  quoteNumber,
  initialItems,
}: {
  quoteId: string;
  quoteNumber: number;
  initialItems: ItemDraft[];
}) {
  const [items, setItems] = useState<ItemDraft[]>(initialItems);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só a resposta do último salvamento vale: uma resposta antiga não apaga um estado mais novo.
  const lastSave = useRef(0);

  const parsed = items.map(parseItem);
  const valid = parsed.flatMap((result) => (result.ok ? [result.item] : []));
  const total = itemsTotal(valid);

  // Pede confirmação ao sair da página com algo ainda não salvo.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  function update(next: ItemDraft[]) {
    setItems(next);
    if (timer.current) clearTimeout(timer.current);
    if (!next.every((item) => parseItem(item).ok)) {
      setStatus("invalid");
      return;
    }
    setStatus("pending");
    timer.current = setTimeout(() => void save(next), SAVE_DELAY_MS);
  }

  async function save(next: ItemDraft[]) {
    const attempt = ++lastSave.current;
    setStatus("saving");
    const result = await saveQuoteItemsAction(quoteId, { items: next });
    if (attempt !== lastSave.current) return;
    if (result.status === "saved") {
      setStatus("saved");
      setMessage(null);
    } else if (result.status === "limit" || result.status === "locked") {
      setStatus("blocked");
      setMessage(result.message);
    } else {
      setStatus("error");
      setMessage(null);
    }
  }

  function changeItem(id: string, field: ItemField, value: string) {
    update(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeItem(id: string) {
    update(items.filter((item) => item.id !== id));
  }

  function addItem() {
    update([...items, newItemDraft()]);
  }

  const sensors = useSensors(
    // Um pequeno movimento antes de começar, para um toque na alça não virar arrasto.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    update(arrayMove(items, from, to));
  }

  const position = (id: string | number) => items.findIndex((item) => item.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Item ${position(active.id)} pego para mover.`,
    onDragOver: ({ over }) => (over ? `Na posição ${position(over.id)}.` : undefined),
    onDragEnd: ({ over }) => (over ? `Item solto na posição ${position(over.id)}.` : undefined),
    onDragCancel: () => "Movimento cancelado.",
  };

  return (
    <div className="flex flex-col gap-6 pb-20 md:pb-24">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Orçamento Nº {formatQuoteNumber(quoteNumber)}</h1>
        <SaveIndicator status={status} onRetry={() => void save(items)} />
      </div>

      <section aria-labelledby="items-heading" className="flex flex-col gap-3">
        <h2 id="items-heading" className="text-base font-medium">
          Itens
        </h2>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "Para mover o item, aperte espaço, use as setas para cima e para baixo e aperte espaço de novo para soltar. Esc cancela.",
            },
          }}
        >
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <ul aria-label="Itens do orçamento" className="flex flex-col gap-2">
              {items.map((item, index) => {
                const result = parsed[index];
                return (
                  <QuoteItemCard
                    key={item.id}
                    item={item}
                    index={index}
                    errors={result && !result.ok ? result.errors : NO_ERRORS}
                    lineTotal={result?.ok ? formatLine(result.item) : ""}
                    onChange={(field, value) => changeItem(item.id, field, value)}
                    onRemove={() => removeItem(item.id)}
                  />
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>

        {items.length < MAX_ITEMS_PER_QUOTE ? (
          <div>
            <Button type="button" variant="outline" onClick={addItem}>
              <Plus aria-hidden="true" />
              Adicionar item
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este orçamento chegou ao limite de {MAX_ITEMS_PER_QUOTE} itens.
          </p>
        )}

        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
      </section>

      {/* Rodapé fixo com o total (F-05). No celular, fica acima da barra de navegação. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background md:bottom-0">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <span className="text-sm text-muted-foreground">Total</span>
          <output aria-label="Total do orçamento" className="text-lg font-semibold tabular-nums">
            {formatBRL(total)}
          </output>
        </div>
      </div>
    </div>
  );
}

const NO_ERRORS: ItemErrors = {};

function formatLine(item: ParsedItem): string {
  return item.unitPriceCents === null ? "" : formatBRL(lineTotals(item).totalCents);
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <span role="status" className="flex items-center gap-2 text-sm text-destructive">
        Não foi possível salvar.
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
          Tentar de novo
        </Button>
      </span>
    );
  }
  const text: Record<Exclude<SaveStatus, "error">, string> = {
    saved: "Salvo ✓",
    pending: "Salvando…",
    saving: "Salvando…",
    invalid: "Corrija os campos destacados para salvar",
    blocked: "Não salvo",
  };
  return (
    <span
      role="status"
      className={
        status === "invalid" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
      }
    >
      {text[status]}
    </span>
  );
}
