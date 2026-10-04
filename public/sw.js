// Service worker do Orçô (RF-36, ADR-0009, NBB-60 W5, NBB-61).
//
// Mínimo de propósito: NÃO guarda páginas nem arquivos (sem modo offline) e não intercepta
// requisições, então nunca mostra uma versão velha do app. Recebe os avisos de push (RN-45) e abre o
// orçamento quando a pessoa toca na notificação.

// Uma versão nova assume logo, sem esperar todas as abas fecharem.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// O servidor manda { title, url, tag } (src/features/push/messages.ts). Só endereços do próprio app.
self.addEventListener("push", (event) => {
  let message = { title: "Orçô", url: "/app/orcamentos", tag: "orco" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Mensagem sem dados ou fora do formato: mostra o aviso genérico.
  }
  // "/caminho" sim; "//outro-site" (que o navegador lê como outro domínio) não.
  const url =
    typeof message.url === "string" && /^\/(?!\/)/.test(message.url)
      ? message.url
      : "/app/orcamentos";
  event.waitUntil(
    self.registration.showNotification(message.title, {
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

// Tocar na notificação: aproveita uma aba do app já aberta, senão abre uma nova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/app/orcamentos", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        return open.navigate(url).then((client) => (client ?? open).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
