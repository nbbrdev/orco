"use client";

import { useEffect, useState } from "react";

import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { detectAppEnvironment } from "@/features/app-shell/environment";
import {
  currentSubscription,
  pushSupported,
  SUBSCRIBE_FAILED_MESSAGE,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from "@/features/push/device";

// "Notificações neste aparelho" (RN-45, F-18, NBB-61 P5). Cada navegador é uma assinatura: ligar pede
// a permissão do sistema e grava a assinatura na conta; desligar cancela aqui e apaga no servidor.
// Quando não dá para ligar, explica o porquê no lugar do botão.

type State =
  | "loading"
  | "unsupported"
  /** iPhone/iPad fora do app instalado: o push só funciona com o Orçô na tela inicial. */
  | "ios-browser"
  /** A pessoa negou a permissão: só ela libera, nas configurações do site. */
  | "denied"
  | "off"
  | "on";

const MESSAGES: Partial<Record<State, string>> = {
  unsupported: "Este navegador não recebe notificações.",
  "ios-browser":
    "No iPhone, adicione o Orçô à tela inicial para receber notificações: toque em Compartilhar e depois em Adicionar à Tela de Início.",
  denied: "As notificações estão bloqueadas neste navegador. Libere nas configurações do site.",
};

export function PushSwitch({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function detect(): Promise<State> {
      if (detectAppEnvironment() === "ios") return "ios-browser";
      if (!vapidPublicKey || !pushSupported()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      return (await currentSubscription()) ? "on" : "off";
    }
    void detect().then(setState);
  }, [vapidPublicKey]);

  async function turnOn() {
    if (!vapidPublicKey) return;
    // Pedido logo no toque: o navegador só mostra a pergunta a partir de um gesto da pessoa.
    const result = await subscribeThisDevice(vapidPublicKey);
    if (result === "failed") {
      setError(SUBSCRIBE_FAILED_MESSAGE);
      return;
    }
    setState(result === "dismissed" ? "off" : result);
  }

  async function turnOff() {
    await unsubscribeThisDevice();
    setState("off");
  }

  async function toggle(next: boolean) {
    setPending(true);
    setError(null);
    try {
      await (next ? turnOn() : turnOff());
    } catch {
      setError("Não foi possível mudar as notificações deste aparelho. Tente de novo.");
    } finally {
      setPending(false);
    }
  }

  const message = MESSAGES[state];

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="profile-push">Notificações neste aparelho</FieldLabel>
        <FieldDescription>
          {message ?? "Avisos no celular ou no computador quando o cliente responder."}
        </FieldDescription>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </FieldContent>
      {message ? null : (
        <Switch
          id="profile-push"
          checked={state === "on"}
          disabled={pending || state === "loading"}
          onCheckedChange={(next) => void toggle(next)}
        />
      )}
    </Field>
  );
}
