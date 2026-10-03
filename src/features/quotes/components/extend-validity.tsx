"use client";

import { CalendarClock } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { defaultValidUntil, formatDateBR, todayInAppTimeZone } from "@/lib/dates";

// Prorrogar a validade de um orçamento expirado (F-11, RN-27, NBB-49 P5-A): um aviso no topo do
// editor e uma janela com a data sugerida (hoje + a validade padrão do perfil). A nova data entra no
// salvamento automático do editor, como qualquer alteração (e sobe a versão, P6-A); com ela, o
// orçamento volta a "enviado", e o mesmo link continua valendo.

export function ExtendValidity({
  validUntil,
  defaultValidityDays,
  onExtend,
}: {
  /** A validade vencida, no formato AAAA-MM-DD. */
  validUntil: string;
  defaultValidityDays: number;
  onExtend: (validUntil: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  function start() {
    setDate(defaultValidUntil(defaultValidityDays));
    setError(null);
    setOpen(true);
  }

  function confirm() {
    if (!date) {
      setError("Informe a nova validade.");
      return;
    }
    if (date < todayInAppTimeZone()) {
      setError("Escolha uma data a partir de hoje.");
      return;
    }
    onExtend(date);
    setOpen(false);
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-status-expired-bg p-3 text-sm text-status-expired"
    >
      <span>Este orçamento venceu em {formatDateBR(validUntil).slice(0, 5)}.</span>
      <Button type="button" variant="outline" size="sm" onClick={start}>
        <CalendarClock aria-hidden="true" />
        Prorrogar validade
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prorrogar validade</DialogTitle>
            <DialogDescription>
              O orçamento volta a enviado, e o mesmo link continua valendo.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="extend-validUntil">Nova validade</FieldLabel>
            <Input
              id="extend-validUntil"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-invalid={!!error}
              className="w-44"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirm}>
              Prorrogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
