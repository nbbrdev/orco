import { expect, type Page, test } from "@playwright/test";

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

test("permissão ainda não pedida: o botão aparece desligado", async ({ page }) => {
  // O navegador de teste pode começar com as notificações bloqueadas, e a emulação do celular nem
  // sempre respeita a permissão dada pelo Playwright: o estado "ainda não pedida" vem simulado.
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
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

// Convite depois do envio (F-18, NBB-61 N1 a N3).

const INVITE = "Quer ser avisado quando o cliente responder?";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** Um orçamento novo com um item, enviado pelo Copiar link. */
async function sendNewQuote(page: Page) {
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  await page.getByLabel("Descrição do item 1").fill("Logo");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
  await copyLinkAndWaitSent(page);
}

async function copyLinkAndWaitSent(page: Page) {
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await page.getByRole("menuitem", { name: "Copiar link" }).click();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page.locator("h1").locator("..").getByText("Enviado")).toBeVisible();
}

test("o convite aparece depois do envio e, com 'Agora não', não volta (F-18)", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", { get: () => "default" });
  });
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-push-321");

  // Rascunho: sem convite. Enviado: o convite aparece.
  await expect(page.getByText(INVITE)).toBeHidden();
  await sendNewQuote(page);
  await expect(page.getByText(INVITE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ativar notificações" })).toBeVisible();
  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(page.getByText(INVITE)).toBeHidden();

  // Outro envio, num rascunho novo (Duplicar): o convite não volta.
  await page.getByRole("button", { name: "Ações do orçamento" }).click();
  await page.getByRole("menuitem", { name: "Duplicar" }).click();
  await expect(page.locator("h1").locator("..").getByText("Rascunho")).toBeVisible();
  await copyLinkAndWaitSent(page);
  await expect(page.getByText(INVITE)).toBeHidden();
});

test("no iPhone fora do app, o convite explica como instalar (F-18)", async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: IPHONE_UA,
    viewport: { width: 390, height: 844 },
    baseURL: "http://localhost:3000",
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-push-654");

  await sendNewQuote(page);
  await expect(page.getByText(INVITE)).toBeVisible();
  await expect(
    page.getByText("No iPhone, adicione o Orçô à tela inicial", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entendi" }).click();
  await expect(page.getByText(INVITE)).toBeHidden();
  await context.close();
});
