"use client";

import { Check, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { respondAction } from "@/features/public-quote/actions";
import { REJECT_REASONS, type RejectReasonCode } from "@/features/public-quote/reasons";
import { QUOTE_EVENT_LIMITS } from "@/lib/db/schema/quote-limits";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

// Aprovar ou recusar (F-07, F-08, RN-32, RN-33, NBB-53 P5). As duas respostas pedem confirmação numa
// janela; o nome (aprovar) e o motivo (recusar) são opcionais. A resposta leva a versão que a página
// mostrou (R2-A). No celular, os botões ficam fixos no rodapé (P4).

const MESSAGES: Record<string, string> = {
  outdated: "O orçamento foi atualizado. Confira de novo antes de responder.",
  limit: "Muitas tentativas, aguarde um instante.",
  invalid: "Confira o que você escreveu e tente de novo.",
  error: "Não foi possível registrar a resposta. Tente de novo.",
};

export function QuoteResponse({
  token,
  version,
  number,
  issuerName,
  issuerPhone,
}: {
  token: string;
  /** A versão mostrada na página (R2-A). */
  version: number;
  /** "0001". */
  number: string;
  issuerName: string | null;
  issuerPhone: string | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"approved" | "rejected" | null>(null);
  const [name, setName] = useState("");
  const [reasonCode, setReasonCode] = useState<RejectReasonCode | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const who = issuerName ?? "O responsável pelo orçamento";

  async function confirm(decision: "approved" | "rejected") {
    setPending(true);
    setMessage(null);
    const input =
      decision === "approved"
        ? { decision, version, respondentName: name }
        : { decision, version, reasonCode: reasonCode ?? undefined, reason };
    const result = await respondAction(token, input);
    setPending(false);
    setDialog(null);
    if (result === "ok") {
      setDone(decision);
      return;
    }
    setMessage(MESSAGES[result] ?? null);
    // Mudou algo do lado do servidor (versão nova, vencido, já respondido): mostra o estado atual.
    if (result !== "limit" && result !== "invalid" && result !== "error") {
      router.refresh();
    }
  }

  if (done) {
    return (
      <section
        role="status"
        className="flex flex-col items-start gap-3 rounded-lg border border-border p-4"
      >
        <p className="font-medium">
          {done === "approved"
            ? `Orçamento aprovado! ${who} foi avisado.`
            : `Orçamento recusado. ${who} foi avisado.`}
        </p>
        {done === "approved" && issuerPhone ? (
          <Button asChild variant="outline">
            <a
              href={buildWhatsAppLink(
                issuerPhone,
                `Olá! Acabei de aprovar o orçamento Nº ${number}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              {issuerName ? `Falar com ${issuerName} no WhatsApp` : "Falar no WhatsApp"}
            </a>
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {/* No celular, fixos no rodapé; no computador, no fim da página. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:border-0 md:p-0">
        <div className="mx-auto flex max-w-3xl gap-3 md:justify-end">
          <Button
            type="button"
            variant="outline"
            className="flex-1 md:flex-none"
            onClick={() => setDialog("rejected")}
          >
            <X aria-hidden="true" />
            Recusar
          </Button>
          <Button
            type="button"
            className="flex-1 md:flex-none"
            onClick={() => setDialog("approved")}
          >
            <Check aria-hidden="true" />
            Aprovar
          </Button>
        </div>
      </div>

      <Dialog
        open={dialog === "approved"}
        onOpenChange={(open) => !pending && setDialog(open ? "approved" : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aprovação?</DialogTitle>
            <DialogDescription>A resposta é definitiva.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="respondent-name">Seu nome (opcional)</FieldLabel>
            <Input
              id="respondent-name"
              autoComplete="name"
              maxLength={QUOTE_EVENT_LIMITS.respondentName}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={() => void confirm("approved")}>
              {pending ? "Enviando…" : "Confirmar aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "rejected"}
        onOpenChange={(open) => !pending && setDialog(open ? "rejected" : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quer dizer o motivo?</DialogTitle>
            <DialogDescription>É opcional. A resposta é definitiva.</DialogDescription>
          </DialogHeader>
          <div role="group" aria-label="Motivo" className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((option) => (
              <button
                key={option.code}
                type="button"
                aria-pressed={reasonCode === option.code}
                onClick={() => setReasonCode(reasonCode === option.code ? null : option.code)}
                className={cn(
                  "h-8 rounded-full border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  reasonCode === option.code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor="reject-reason">Quer contar mais? (opcional)</FieldLabel>
            <Textarea
              id="reject-reason"
              rows={3}
              maxLength={QUOTE_EVENT_LIMITS.reason}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void confirm("rejected")}
            >
              {pending ? "Enviando…" : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
