"use client";

import { Plus, Search } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ClientForm } from "@/features/clients/components/client-form";
import type { ClientRow } from "@/features/clients/schemas";
import { searchClients } from "@/features/clients/search";
import { formatDocument } from "@/lib/document";

// Lista de clientes (F-15, NBB-44): todos os clientes chegam de uma vez e a busca filtra aqui, na
// hora (K4-A). Novo e editar abrem o mesmo painel (K5-A): na lateral no computador, de baixo no
// celular.

const byName = (a: ClientRow, b: ClientRow) => a.name.localeCompare(b.name, "pt-BR");

/** Painel aberto: `null` fechado, "new" para um cliente novo, ou o cliente em edição. */
type Panel = null | "new" | ClientRow;

export function ClientList({ initial }: { initial: ClientRow[] }) {
  const [list, setList] = useState(initial);
  const [term, setTerm] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const wide = useMediaQuery("(min-width: 640px)");

  const editing = panel !== null && panel !== "new" ? panel : null;
  const found = searchClients(list, term);

  function onSaved(client: ClientRow) {
    setList((current) => [...current.filter((item) => item.id !== client.id), client].sort(byName));
    setPanel(null);
  }

  function onDeleted(id: string) {
    setList((current) => current.filter((item) => item.id !== id));
    setPanel(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Button type="button" onClick={() => setPanel("new")}>
          <Plus aria-hidden="true" />
          Novo cliente
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum cliente ainda. Toque em Novo cliente para cadastrar o primeiro.
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
              aria-label="Buscar clientes"
              placeholder="Buscar por nome, e-mail ou CPF/CNPJ"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="pl-9"
            />
          </div>

          {found.length === 0 ? (
            <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
          ) : (
            <ul aria-label="Clientes" className="flex flex-col divide-y rounded-lg border">
              {found.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => setPanel(client)}
                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="font-medium">{client.name}</span>
                    <Details client={client} />
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
            <SheetTitle>{editing ? "Editar cliente" : "Novo cliente"}</SheetTitle>
            <SheetDescription>Só o nome é obrigatório.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {panel !== null ? (
              <ClientForm
                key={editing?.id ?? "new"}
                client={editing}
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

/** Contatos do cliente, numa linha só, embaixo do nome. */
function Details({ client }: { client: ClientRow }) {
  const details = [
    client.email,
    client.phone,
    client.document ? formatDocument(client.document) : null,
  ].filter(Boolean);
  return details.length > 0 ? (
    <span className="text-sm text-muted-foreground">{details.join(" · ")}</span>
  ) : null;
}

/** Se a tela casa com a media query. No servidor (e até hidratar), considera que não. */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
