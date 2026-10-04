"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { detectAppEnvironment } from "@/features/app-shell/environment";
import { markPushPromptedAction } from "@/features/push/actions";
import {
  currentSubscription,
  pushSupported,
  SUBSCRIBE_FAILED_MESSAGE,
  subscribeThisDevice,
} from "@/features/push/device";

// Convite de notificações depois de um envio (F-18, RN-45, NBB-61 N1-A a N3). Aparece uma vez por
// conta: tocar em qualquer botão marca a conta como convidada (`push_prompted_at`), e ele não volta.
// Não aparece (N2):
// - neste aparelho já ligado, ou com a permissão bloqueada: marca a conta, porque não há o que pedir;
// - em navegador sem suporte (ou sem as chaves VAPID): não marca, para aparecer num aparelho que suporte.
// No iPhone fora do app instalado, explica como instalar (o push só funciona assim).

type State = "checking" | "ask" | "ios" | "done" | "hidden";

export function PushInvite({
  vapidPublicKey,
  onClose,
}: {
  vapidPublicKey: string | null;
  /** O convite terminou (ou não precisava aparecer): o editor não o mostra mais. */
  onClose: () => void;
}) {
  const [state, setState] = useState<State>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function detect(): Promise<State> {
      if (detectAppEnvironment() === "ios") return "ios";
      if (!vapidPublicKey || !pushSupported()) return "hidden";
      if (Notification.permission === "denied" || (await currentSubscription())) {
        void markPushPromptedAction();
        return "hidden";
      }
      return "ask";
    }
    void detect().then((next) => {
      setState(next);
      if (next === "hidden") onClose();
    });
  }, [vapidPublicKey, onClose]);

  function close() {
    void markPushPromptedAction();
    setState("hidden");
    onClose();
  }

  async function activate() {
    if (!vapidPublicKey) return;
    setPending(true);
    setError(null);
    try {
      const result = await subscribeThisDevice(vapidPublicKey);
      if (result === "failed") {
        setError(SUBSCRIBE_FAILED_MESSAGE);
        return;
      }
      void markPushPromptedAction();
      if (result === "on") {
        setState("done");
      } else {
        // Negou ou fechou a pergunta do sistema: o convite não volta (F-18); dá para ligar no Perfil.
        setState("hidden");
        onClose();
      }
    } catch {
      setError(SUBSCRIBE_FAILED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  if (state === "checking" || state === "hidden") return null;

  if (state === "done") {
    return (
      <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm">
        Pronto! Você será avisado neste aparelho.
      </p>
    );
  }

  return (
    <section
      aria-label="Notificações"
      className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Bell aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">Quer ser avisado quando o cliente responder?</p>
          {state === "ios" ? (
            <p className="text-sm text-muted-foreground">
              No iPhone, adicione o Orçô à tela inicial para receber notificações: toque em{" "}
              <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
              Depois, ligue as notificações no Perfil.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {state === "ios" ? (
          <Button type="button" variant="outline" size="sm" onClick={close}>
            Entendi
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={close}>
              Agora não
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={() => void activate()}>
              {pending ? "Ativando…" : "Ativar notificações"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
