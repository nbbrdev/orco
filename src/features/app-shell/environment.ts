// Onde o app está aberto (F-18, NBB-60 W6, NBB-61 P5): instalado (como app), no Safari do iPhone/iPad
// ou em outro navegador. Usado pelo "Instalar o Orçô" e pelo botão de notificações, porque no iPhone
// o push só funciona com o app instalado na tela inicial (RN-45). Só existe no navegador.

export type AppEnvironment = "installed" | "ios" | "other";

export function detectAppEnvironment(): AppEnvironment {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "other";
}
