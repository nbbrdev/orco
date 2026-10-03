"use client";

import { ChevronsUpDown, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ClientRow } from "@/features/clients/schemas";
import { searchClients } from "@/features/clients/search";
import { createClientForQuoteAction, setQuoteClientAction } from "@/features/quotes/actions";
import type { QuoteClient } from "@/features/quotes/quotes";
import { formatDocument } from "@/lib/document";

// Cliente do orçamento (F-05, NBB-87): um campo que busca entre os clientes enquanto se digita
// (C2-A), com "Criar 'Fulano'" no fim (C4-A, RF-12). Escolhido, mostra o nome e os contatos, com
// Trocar e × (C3-A). O orçamento guarda uma cópia dos dados (RN-20) e salva na hora.

const VISIBLE_RESULTS = 30;

export function ClientPicker({
  quoteId,
  clients,
  initialClient,
}: {
  quoteId: string;
  clients: ClientRow[];
  initialClient: QuoteClient | null;
}) {
  const [options, setOptions] = useState(clients);
  const [client, setClient] = useState(initialClient);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const found = searchClients(options, term).slice(0, VISIBLE_RESULTS);
  const typed = term.trim();

  function apply(result: Awaited<ReturnType<typeof createClientForQuoteAction>>) {
    if (result.status === "saved") {
      setClient(result.client);
      setMessage(null);
      setOpen(false);
      setTerm("");
    } else if (result.status === "not_found") {
      setMessage("Este cliente não existe mais. Atualize a página.");
    } else {
      setMessage(result.message);
    }
  }

  function choose(id: string | null) {
    startTransition(async () => apply(await setQuoteClientAction(quoteId, id)));
  }

  function create() {
    startTransition(async () => {
      const result = await createClientForQuoteAction(quoteId, typed);
      const created = result.status === "saved" ? result.client : null;
      if (created?.id) {
        // O cliente novo passa a aparecer na busca, sem recarregar a página.
        const id = created.id;
        setOptions((current) => [...current, { ...created, id, internalNotes: null }]);
      }
      apply(result);
    });
  }

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {client ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending}>
            Trocar
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            // Um combobox não tira o nome do texto de dentro: o leitor de tela precisa deste.
            aria-label="Escolher cliente (opcional)"
            aria-expanded={open}
            className="w-full justify-between font-normal text-muted-foreground"
            disabled={pending}
          >
            Escolher cliente (opcional)
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command label="Buscar cliente" shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou criar cliente"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList>
            {typed ? null : <CommandEmpty>Digite o nome do cliente.</CommandEmpty>}
            <CommandGroup>
              {found.map((option) => (
                <CommandItem key={option.id} value={option.id} onSelect={() => choose(option.id)}>
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
              {typed ? (
                <CommandItem value="__create" onSelect={create}>
                  <Plus aria-hidden="true" />
                  Criar &quot;{typed}&quot;
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <section aria-labelledby="client-heading" className="flex flex-col gap-2">
      <h2 id="client-heading" className="text-base font-medium">
        Cliente
      </h2>
      {client ? (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="font-medium">{client.name}</p>
            <ClientDetails client={client} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {picker}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Tirar o cliente"
              disabled={pending}
              onClick={() => choose(null)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        picker
      )}
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function ClientDetails({ client }: { client: QuoteClient }) {
  const details = [
    client.email,
    client.phone,
    client.document ? formatDocument(client.document) : null,
  ].filter(Boolean);
  return details.length > 0 ? (
    <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
  ) : null;
}
