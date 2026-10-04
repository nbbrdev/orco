import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// "Notificações neste aparelho" no perfil (RN-45, NBB-61 P5, P7): os estados que dá para simular no
// navegador de teste. A assinatura de verdade depende do serviço de push do Google ou da Apple e é
// testada à mão no staging. Precisa das chaves VAPID no .env (no CI, valores de mentira).

const label = "Notificações neste aparelho";

test("permissão bloqueada: explica como liberar, sem o botão", async ({ page }) => {
  // Simula a pessoa ter negado as notificações antes.
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "denied" });
  });
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-push-123");
  await page.goto("/app/perfil");

  await expect(page.getByText(label)).toBeVisible();
  await expect(
    page.getByText(
      "As notificações estão bloqueadas neste navegador. Libere nas configurações do site.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("switch", { name: label })).toHaveCount(0);
});

test("ligado e desligado: o botão aparece com a permissão ainda não pedida", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-push-456");
  await page.goto("/app/perfil");
  const toggle = page.getByRole("switch", { name: label });
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();
});

test("iPhone fora do app instalado: mostra como adicionar à tela inicial", async ({ browser }) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
    baseURL: "http://localhost:3000",
  });
  const page = await context.newPage();
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-push-789");
  await page.goto("/app/perfil");

  await expect(
    page.getByText("No iPhone, adicione o Orçô à tela inicial para receber notificações", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("switch", { name: label })).toHaveCount(0);
  await context.close();
});
