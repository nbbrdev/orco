"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicQuoteView } from "@/features/public-quote/components/public-quote-view";
import {
  type ItemDraft,
  type ItemTextField,
  newItemDraft,
  parseItem,
  type ParsedItem,
  quoteTotals,
} from "@/features/quotes/items";
import { addDays, todayInAppTimeZone } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { buildQuoteDocument } from "@/pdf/model";

// Experimentar sem conta (NBB-95): um mini editor com até 3 itens e a página do cliente ao lado.
// Tudo fica na memória desta página (E5-A): nada vai ao servidor, e recarregar apaga. A conta e a
// validação são as do app de verdade (items.ts, money.ts), e a prévia é o mesmo PublicQuoteView.
// - E1-B: começa com um item de exemplo, que a pessoa edita.
// - E3-B: no computador, editor e prévia lado a lado, ao vivo; no celular, um de cada vez.
// - E4-A: Aprovar e Recusar são simulados.

const MAX_DEMO_ITEMS = 3;
const NO_STORED_DISCOUNT = { type: null, value: 0 };

/** O item de exemplo (E1-B). O id é fixo, para o servidor e o navegador desenharem igual. */
const exampleItem = (): ItemDraft => ({
  ...newItemDraft(),
  id: "demo-1",
  description: "Criação de logotipo",
  unitPrice: "800,00",
});

type Response = "approved" | "rejected" | null;

export function DemoQuote() {
  const [now] = useState(() => new Date());
  const [businessName, setBusinessName] = useState("");
  const [items, setItems] = useState<ItemDraft[]>(() => [exampleItem()]);
  const [showPreview, setShowPreview] = useState(false);
  const [response, setResponse] = useState<Response>(null);

  const parsed = items.map(parseItem);
  const validItems = parsed.flatMap((result) => (result.ok ? [result.item] : []));
  const total = quoteTotals(validItems, NO_STORED_DISCOUNT).totalCents;
  const model = buildModel(businessName, validItems, now);

  function edit(next: ItemDraft[]) {
    setItems(next);
    setResponse(null);
  }

  function changeField(id: string, field: ItemTextField, value: string) {
    edit(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function restart() {
    setBusinessName("");
    setItems([exampleItem()]);
    setResponse(null);
    setShowPreview(false);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-start">
      {/* Editor. No celular, some quando a prévia está aberta. */}
      <section
        aria-labelledby="demo-editor-title"
        className={cn("flex flex-col gap-5", showPreview && "hidden md:flex")}
      >
        <h2 id="demo-editor-title" className="text-lg font-semibold">
          Monte o orçamento
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="demo-business-name">Seu nome ou da sua empresa (opcional)</Label>
          <Input
            id="demo-business-name"
            value={businessName}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => {
              setBusinessName(event.target.value);
              setResponse(null);
            }}
          />
        </div>

        <ol className="flex flex-col gap-3">
          {items.map((item, index) => {
            const result = parsed[index];
            const errors = result && !result.ok ? result.errors : {};
            const label = `item ${index + 1}`;
            return (
              <li
                key={item.id}
                aria-label={`Item ${index + 1}`}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor={`${item.id}-description`}>Descrição</Label>
                    <Input
                      id={`${item.id}-description`}
                      value={item.description}
                      placeholder="Ex.: Criação de logotipo"
                      autoComplete="off"
                      aria-invalid={!!errors.description}
                      onChange={(event) => changeField(item.id, "description", event.target.value)}
                    />
                  </div>
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover o ${label}`}
                      onClick={() => edit(items.filter((other) => other.id !== item.id))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-[7rem_1fr] gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${item.id}-quantity`}>Quantidade</Label>
                    <Input
                      id={`${item.id}-quantity`}
                      value={item.quantity}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={!!errors.quantity}
                      onChange={(event) => changeField(item.id, "quantity", event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${item.id}-price`}>Valor (R$)</Label>
                    <Input
                      id={`${item.id}-price`}
                      value={item.unitPrice}
                      placeholder="0,00"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={!!errors.unitPrice}
                      onChange={(event) => changeField(item.id, "unitPrice", event.target.value)}
                    />
                  </div>
                </div>
                {Object.values(errors).map((message) => (
                  <p key={message} className="text-sm text-destructive">
                    {message}
                  </p>
                ))}
              </li>
            );
          })}
        </ol>

        {items.length < MAX_DEMO_ITEMS ? (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => edit([...items, newItemDraft()])}
          >
            <Plus aria-hidden="true" />
            Adicionar item
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Na demonstração, até {MAX_DEMO_ITEMS} itens. Na sua conta, quantos precisar.
          </p>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-muted-foreground">Total</span>
          <span role="status" className="text-xl font-semibold tabular-nums">
            {formatBRL(total)}
          </span>
        </div>

        <Button type="button" size="lg" className="md:hidden" onClick={() => setShowPreview(true)}>
          Ver como o cliente recebe
        </Button>
      </section>

      {/* Prévia: a página do cliente de verdade, sempre clara (NBB-92). */}
      <section
        aria-labelledby="demo-preview-title"
        className={cn("flex flex-col gap-4", !showPreview && "hidden md:flex")}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="demo-preview-title" className="text-lg font-semibold">
            Como o cliente recebe
          </h2>
          <Button
            type="button"
            variant="outline"
            className="md:hidden"
            onClick={() => setShowPreview(false)}
          >
            Voltar e editar
          </Button>
        </div>
        <div className="light-scheme flex flex-col gap-6 rounded-lg border border-border bg-background p-5 text-foreground">
          <PublicQuoteView model={model} logoUrl={null} compact titleAs="p" />
          {response ? (
            <DemoResult response={response} onRestart={restart} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => setResponse("rejected")}>
                Recusar
              </Button>
              <Button type="button" onClick={() => setResponse("approved")}>
                Aprovar
              </Button>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Toque em Aprovar ou Recusar para ver o que acontece. É só uma simulação: nada é enviado
          nem guardado.
        </p>
      </section>
    </div>
  );
}

function DemoResult({ response, onRestart }: { response: Response; onRestart: () => void }) {
  const message =
    response === "approved"
      ? "Orçamento aprovado! No Orçô de verdade, você receberia um aviso por e-mail e no celular agora."
      : "Orçamento recusado. No Orçô de verdade, você receberia um aviso por e-mail e no celular, com o motivo, se o cliente escrevesse um.";
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg bg-muted p-4">
      <p className="font-medium">{message}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/cadastro">Criar conta grátis</Link>
        </Button>
        <Button type="button" variant="ghost" onClick={onRestart}>
          Experimentar de novo
        </Button>
      </div>
    </div>
  );
}

/** A página do cliente com o que a pessoa digitou: emitido hoje, válido por 15 dias. */
function buildModel(businessName: string, items: ParsedItem[], now: Date) {
  return buildQuoteDocument({
    profile: {
      businessName: businessName.trim() || null,
      displayName: null,
      phone: null,
      contactEmail: null,
      website: null,
      instagram: null,
      document: null,
      paymentInfo: null,
    },
    logoPng: null,
    quote: {
      number: 1,
      status: "sent",
      sentAt: now,
      validUntil: addDays(todayInAppTimeZone(now), 15),
      client: null,
      items,
      discount: NO_STORED_DISCOUNT,
      paymentTerms: null,
      deliveryTime: null,
      notes: null,
    },
    now,
  });
}
