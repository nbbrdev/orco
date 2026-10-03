// Service worker do Orçô (RF-36, ADR-0009, NBB-60 W5).
//
// Mínimo de propósito: NÃO guarda páginas nem arquivos (sem modo offline) e não intercepta
// requisições, então nunca mostra uma versão velha do app. Os avisos de push (`push` e
// `notificationclick`) entram aqui na issue de push.

// Uma versão nova assume logo, sem esperar todas as abas fecharem.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
