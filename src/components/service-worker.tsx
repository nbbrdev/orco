"use client";

import { useEffect } from "react";

// Registra o service worker do PWA (RF-36, ADR-0009, NBB-60 W5). Ele não guarda páginas (sem modo
// offline); os avisos de push entram nele na issue de push.
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Falha ao registrar o service worker.", error);
      });
    }
  }, []);
  return null;
}
