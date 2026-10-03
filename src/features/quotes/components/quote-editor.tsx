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
import type { ClientRow } from "@/features/clients/schemas";
import { saveItemToCatalogAction, saveQuoteItemsAction } from "@/features/quotes/actions";
import {
  type CatalogSuggestion,
  type DiscountDraft,
  describeDiscount,
  fillFromCatalog,
  formatQuoteNumber,
  isDiscountCapped,
  type ItemDraft,
  type ItemErrors,
  type ItemTextField,
  lineTotals,
  newItemDraft,
  type OptionsDraft,
  type OptionsErrors,
  type ParsedItem,
  parseItem,
  parseOptions,
  quoteTotals,
} from "@/features/quotes/items";
import type { QuoteClient } from "@/features/quotes/quotes";
import { MAX_ITEMS_PER_QUOTE } from "@/lib/db/schema/quote-limits";
import { formatBRL } from "@/lib/money";

import { ClientPicker } from "./client-picker";
import { MoreOptions } from "./more-options";
import { QuoteItemCard } from "./quote-item-card";

// Editor de orçamento (F-05): cliente (NBB-87), itens, total na hora e salvamento automático (NBB-86),
// descontos e "Mais opções" (NBB-88).
// - O cliente salva na hora em que é escolhido; itens e opções, pelo salvamento automático.
// - Cada mudança agenda um salvamento do orçamento inteiro ~800 ms depois (P2-A, RN-21, G3-A). Se
//   algum campo estiver inválido, nada é salvo até corrigir (P3-A).
// - Reordenar arrastando pela alça (R2-B), também pelo teclado (espaço, setas, espaço).

const SAVE_DELAY_MS = 800;
const CAPPED_HINT = "O desconto ficou limitado ao valor.";

type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "error" | "blocked";

export function QuoteEditor({
  quoteId,
  quoteNumber,
  initialItems,
  initialOptions,
  initialClient,
  clients,
  initialCatalog,
}: {
  quoteId: string;
  quoteNumber: number;
  initialItems: ItemDraft[];
  initialOptions: OptionsDraft;
  initialClient: QuoteClient | null;
  clients: ClientRow[];
  initialCatalog: CatalogSuggestion[];
}) {
  const [items, setItems] = useState<ItemDraft[]>(initialItems);
  const [options, setOptions] = useState<OptionsDraft>(initialOptions);
  const [catalog, setCatalog] = useState(initialCatalog);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só a resposta do último salvamento vale: uma resposta antiga não apaga um estado mais novo.
  const lastSave = useRef(0);
  // O estado mais recente, para quem continua depois de esperar o servidor (ex.: salvar no catálogo).
  const latest = useRef(initialItems);
  const latestOptions = useRef(initialOptions);

  const parsed = items.map(parseItem);
  const valid = parsed.flatMap((result) => (result.ok ? [result.item] : []));
  const parsedOptions = parseOptions(options);
  const quoteDiscount = parsedOptions.ok ? parsedOptions.options.discount : NO_STORED_DISCOUNT;
  const totals = quoteTotals(valid, quoteDiscount);
  const optionErrors = parsedOptions.ok ? NO_OPTION_ERRORS : parsedOptions.errors;

  // Pede confirmação ao sair da página com algo ainda não salvo.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  function schedule(nextItems: ItemDraft[], nextOptions: OptionsDraft) {
    latest.current = nextItems;
    latestOptions.current = nextOptions;
    setItems(nextItems);
    setOptions(nextOptions);
    if (timer.current) clearTimeout(timer.current);
    if (!nextItems.every((item) => parseItem(item).ok) || !parseOptions(nextOptions).ok) {
      setStatus("invalid");
      return;
    }
    setStatus("pending");
    timer.current = setTimeout(() => void save(nextItems, nextOptions), SAVE_DELAY_MS);
  }

  function update(next: ItemDraft[]) {
    schedule(next, latestOptions.current);
  }

  function updateOptions(next: OptionsDraft) {
    schedule(latest.current, next);
  }

  async function save(nextItems: ItemDraft[], nextOptions: OptionsDraft) {
    const attempt = ++lastSave.current;
    setStatus("saving");
    const result = await saveQuoteItemsAction(quoteId, { items: nextItems, options: nextOptions });
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

  function changeItem(id: string, field: ItemTextField, value: string) {
    update(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function changeDiscount(id: string, discount: DiscountDraft) {
    update(items.map((item) => (item.id === id ? { ...item, discount } : item)));
  }

  function removeItem(id: string) {
    update(items.filter((item) => item.id !== id));
  }

  /** Sugestão do catálogo escolhida na descrição (C6-A). */
  function pickFromCatalog(id: string, suggestion: CatalogSuggestion) {
    update(items.map((item) => (item.id === id ? fillFromCatalog(item, suggestion) : item)));
  }

  /** "Salvar no catálogo" (C7-B): cria no catálogo e liga o item a ele. */
  async function saveToCatalog(id: string) {
    const item = latest.current.find((entry) => entry.id === id);
    if (!item) return;
    const result = await saveItemToCatalogAction(item);
    if (result.status !== "saved") {
      setMessage(result.message);
      return;
    }
    setMessage(null);
    setCatalog((current) => [...current, result.item]);
    update(
      latest.current.map((entry) =>
        entry.id === id ? { ...entry, catalogItemId: result.item.id } : entry,
      ),
    );
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
    <div className="flex flex-col gap-6 pb-24 md:pb-28">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Orçamento Nº {formatQuoteNumber(quoteNumber)}</h1>
        <SaveIndicator status={status} onRetry={() => void save(items, options)} />
      </div>

      <ClientPicker quoteId={quoteId} clients={clients} initialClient={initialClient} />

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
                const line = result?.ok ? lineTotals(result.item) : null;
                return (
                  <QuoteItemCard
                    key={item.id}
                    item={item}
                    index={index}
                    errors={result && !result.ok ? result.errors : NO_ERRORS}
                    lineTotal={result?.ok ? formatLine(result.item) : ""}
                    discountHint={
                      result?.ok && line && isDiscountCapped(result.item.discount, line.grossCents)
                        ? CAPPED_HINT
                        : undefined
                    }
                    catalog={catalog}
                    onChange={(field, value) => changeItem(item.id, field, value)}
                    onDiscountChange={(discount) => changeDiscount(item.id, discount)}
                    onPick={(suggestion) => pickFromCatalog(item.id, suggestion)}
                    onSaveToCatalog={() => void saveToCatalog(item.id)}
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

      <MoreOptions
        options={options}
        errors={optionErrors}
        discountHint={
          isDiscountCapped(quoteDiscount, totals.subtotalCents) ? CAPPED_HINT : undefined
        }
        onChange={updateOptions}
      />

      {/* Rodapé fixo com o total (F-05). No celular, fica acima da barra de navegação. Com desconto
          geral, uma linha menor mostra o subtotal e o desconto (G4-A). */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background md:bottom-0">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 py-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <div className="flex flex-col items-end">
            {totals.discountCents > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                Subtotal {formatBRL(totals.subtotalCents)} · Desconto −
                {formatBRL(totals.discountCents)}
              </span>
            ) : null}
            <output aria-label="Total do orçamento" className="text-lg font-semibold tabular-nums">
              {formatBRL(totals.totalCents)}
            </output>
          </div>
        </div>
      </div>
    </div>
  );
}

const NO_ERRORS: ItemErrors = {};
const NO_OPTION_ERRORS: OptionsErrors = {};
const NO_STORED_DISCOUNT = { type: null, value: 0 } as const;

/** Total da linha, com o desconto entre parênteses (G1-A): "R$ 720,00 (−10%)". */
function formatLine(item: ParsedItem): string {
  if (item.unitPriceCents === null) return "";
  const totals = lineTotals(item);
  const discount = describeDiscount(item.discount, totals.discountCents);
  return discount ? `${formatBRL(totals.totalCents)} (${discount})` : formatBRL(totals.totalCents);
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
