"use client";

import { useEffect, useRef, useState } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { saveInternalNotesAction } from "@/features/quotes/actions";
import { QUOTE_LIMITS } from "@/lib/db/schema/quote-limits";

import { SAVE_DELAY_MS, SaveIndicator, type SaveStatus } from "./quote-editor";

// Anotações internas no modo leitura (RN-20a, NBB-53 M4-A): o único campo editável de um aprovado ou
// recusado. Salva sozinho, com a mesma espera e o mesmo indicador do editor.

export function InternalNotes({
  quoteId,
  initialNotes,
}: {
  quoteId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só a resposta do último salvamento vale: uma resposta antiga não apaga um estado mais novo.
  const lastSave = useRef(0);
  const tooLong = notes.trim().length > QUOTE_LIMITS.internalNotes;

  // Pede confirmação ao sair da página com algo ainda não salvo.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  function change(next: string) {
    setNotes(next);
    if (timer.current) clearTimeout(timer.current);
    if (next.trim().length > QUOTE_LIMITS.internalNotes) {
      setStatus("invalid");
      return;
    }
    setStatus("pending");
    timer.current = setTimeout(() => {
      timer.current = null;
      void save(next);
    }, SAVE_DELAY_MS);
  }

  async function save(next: string) {
    const attempt = ++lastSave.current;
    setStatus("saving");
    const result = await saveInternalNotesAction(quoteId, next);
    if (attempt !== lastSave.current) return;
    if (result.status === "saved") {
      setStatus("saved");
      setError(null);
    } else if (result.status === "invalid") {
      setStatus("invalid");
      setError(result.message);
    } else {
      setStatus("error");
      setError(null);
    }
  }

  const message = tooLong ? `Use até ${QUOTE_LIMITS.internalNotes} caracteres.` : error;

  return (
    <Field data-invalid={!!message}>
      <div className="flex items-center justify-between gap-4">
        <FieldLabel htmlFor="quote-internalNotes">Anotações internas</FieldLabel>
        <SaveIndicator status={status} onRetry={() => void save(notes)} />
      </div>
      <Textarea
        id="quote-internalNotes"
        rows={3}
        value={notes}
        onChange={(event) => change(event.target.value)}
        aria-invalid={!!message}
      />
      <FieldDescription>Só você vê. Nunca aparecem no orçamento.</FieldDescription>
      {message ? <FieldError>{message}</FieldError> : null}
    </Field>
  );
}
