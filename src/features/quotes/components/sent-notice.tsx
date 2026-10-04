import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

// Aviso do orçamento já enviado (F-10, NBB-54 A1 a A5): lembra que o cliente vê as alterações pelo
// link. Depois de uma alteração salva, oferece avisar o cliente pelo WhatsApp; depois do aviso, volta
// ao texto inicial (A4-A).

export function SentNotice({ updated, onNotify }: { updated: boolean; onNotify: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg bg-muted px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-muted-foreground">
        {updated
          ? "Orçamento atualizado."
          : "Este orçamento já foi enviado. O cliente verá as alterações ao abrir o link."}
      </p>
      {updated ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={onNotify}>
          <MessageCircle aria-hidden="true" />
          Avisar cliente no WhatsApp
        </Button>
      ) : null}
    </div>
  );
}
