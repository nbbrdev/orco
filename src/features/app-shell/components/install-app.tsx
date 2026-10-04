"use client";

import { Download } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { type AppEnvironment, detectAppEnvironment } from "@/features/app-shell/environment";

// "Instalar o Orçô" (F-14, F-18, NBB-60 W6):
// - Android e computador: o botão só aparece quando o navegador oferece a instalação;
// - iPhone/iPad (Safari): não há botão possível, então mostra o caminho pelo menu Compartilhar;
// - já instalado (aberto como app): não mostra nada.

/** Evento do Chrome/Edge que permite abrir a janela de instalação na hora certa. Não está nos tipos do TS. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Onde o app está aberto. No servidor, "server" (não mostra nada). */
type Environment = "server" | AppEnvironment;

const noSubscription = () => () => {};

export function InstallApp() {
  const environment = useSyncExternalStore(
    noSubscription,
    detectAppEnvironment,
    (): Environment => "server",
  );
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (environment !== "other") return;
    function onPrompt(event: Event) {
      // Impede o banner automático: a instalação fica no botão do perfil.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [environment]);

  if (environment === "ios") {
    return (
      <p className="text-sm text-muted-foreground">
        Para instalar o Orçô no iPhone, toque em <strong>Compartilhar</strong> e depois em{" "}
        <strong>Adicionar à Tela de Início</strong>.
      </p>
    );
  }

  if (!promptEvent) return null;

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await promptEvent.prompt();
          await promptEvent.userChoice;
          // O mesmo evento não pode ser usado de novo.
          setPromptEvent(null);
        }}
      >
        <Download aria-hidden="true" />
        Instalar o Orçô
      </Button>
    </div>
  );
}
