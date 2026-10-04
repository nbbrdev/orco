import { type Browser, expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Compartilhar e responder (NBB-54 C7): copiar o link, WhatsApp e gerar novo link (F-06, F-13); o
// cliente aprova ou recusa pelo link (F-07, F-08), e o dono vê o resultado em modo leitura (NBB-53).
// O link sai da área de transferência, como o freelancer faria; o E2E não lê o banco.

const LINK = /^https?:\/\/[^/]+\/p\/[A-Za-z0-9_-]{43}$/;

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

/** Um orçamento novo, com um item pronto para enviar (o IP próprio vem antes, no teste). */
async function newQuote(page: Page, password: string) {
  await signUpAndConfirm(page, password);
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  await page.getByLabel("Descrição do item 1").fill("Logo");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
}

/** Compartilhar → Copiar link, e o link copiado. */
async function copyLink(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await page.getByRole("menuitem", { name: "Copiar link" }).click();
  await expect(page.getByText("Link copiado ✓")).toBeVisible();
  // O menu fica aberto um instante com o "Link copiado ✓" e bloqueia a página até fechar.
  await expect(page.getByRole("menu")).toBeHidden();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(LINK);
  // O envio acontece logo depois da cópia (C3-A): o link só funciona quando o selo vira "Enviado".
  await expect(page.locator("h1").locator("..").getByText("Enviado")).toBeVisible();
  return link;
}

/** Um navegador à parte, sem a sessão do dono: é o cliente. */
async function clientPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

test("copiar o link, WhatsApp e gerar novo link (F-06, F-13, RN-22, RN-36)", async ({
  page,
  context,
  browser,
}) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-share-123");
  await page.getByRole("button", { name: "Criar primeiro orçamento" }).click();
  await expect(page).toHaveURL(/\/app\/orcamentos\/[0-9a-f-]{36}$/);
  const header = page.locator("h1").locator("..");

  // Faltando descrição e valor (RN-13): não copia e destaca os campos.
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await page.getByRole("menuitem", { name: "Copiar link" }).click();
  await expect(page.getByText("Informe o valor do item 1 para enviar.")).toBeVisible();
  await expect(header.getByText("Rascunho")).toBeVisible();

  // Preenchendo, copia o link e envia (RN-22).
  await page.getByLabel("Descrição do item 1").fill("Logo");
  await page.getByLabel("Valor do item 1 (R$)").fill("800");
  const link = await copyLink(page);
  await expect(header.getByText("Enviado")).toBeVisible();

  // WhatsApp: abre o wa.me com a mensagem já escrita. Sem telefone do cliente, a pessoa escolhe o
  // contato. O wa.me não é carregado de verdade.
  await context.route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp" }));
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "Compartilhar" }).click();
  await page.getByRole("menuitem", { name: "WhatsApp" }).click();
  const whatsApp = await popup;
  await whatsApp.waitForURL(/^https:\/\/wa\.me\//);
  const url = new URL(whatsApp.url());
  expect(url.pathname).toBe("/");
  expect(url.searchParams.get("text")).toBe(`Olá! Segue o orçamento Nº 0001: ${link}`);
  await whatsApp.close();

  // O link funciona para o cliente.
  const client = await clientPage(browser);
  await useOwnIp(client);
  await client.goto(link);
  await expect(client.getByRole("heading", { name: "Orçamento Nº 0001" })).toBeVisible();

  // Gerar novo link (RN-36): o anterior para de funcionar na hora.
  await page.getByRole("button", { name: "Ações do orçamento" }).click();
  await page.getByRole("menuitem", { name: "Gerar novo link" }).click();
  await expect(page.getByText("O link atual deixará de funcionar.")).toBeVisible();
  await page.getByRole("button", { name: "Gerar novo link" }).click();
  await expect(page.getByText("Novo link gerado. O anterior não funciona mais.")).toBeVisible();
  const fresh = await copyLink(page);
  expect(fresh).not.toBe(link);

  await client.reload();
  await expect(client.getByRole("heading", { name: "Orçamento não encontrado" })).toBeVisible();
  await client.goto(fresh);
  await expect(client.getByRole("heading", { name: "Orçamento Nº 0001" })).toBeVisible();
  await client.context().close();
});

test("o cliente aprova pelo link e o dono vê em modo leitura (F-07, RN-25, RN-20a)", async ({
  page,
  browser,
}) => {
  await useOwnIp(page);
  await newQuote(page, "senha-share-456");
  const quoteUrl = page.url();
  const link = await copyLink(page);

  const client = await clientPage(browser);
  await useOwnIp(client);
  await client.goto(link);
  await client.getByRole("button", { name: "Aprovar" }).click();
  await client.getByLabel("Seu nome (opcional)").fill("Maria");
  await client.getByRole("button", { name: "Confirmar aprovação" }).click();
  await expect(client.getByText(/Orçamento aprovado!/)).toBeVisible();
  await client.context().close();

  // O dono: o resultado no topo, só as anotações editáveis.
  await page.goto(quoteUrl);
  await expect(
    page.getByText(/^Aprovado por Maria em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/),
  ).toBeVisible();
  await expect(page.getByLabel("Descrição do item 1")).toHaveCount(0);
  await page.getByLabel("Anotações internas").fill("Pagou o sinal.");
  await expect(page.getByRole("status").filter({ hasText: "Salvo ✓" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Anotações internas")).toHaveValue("Pagou o sinal.");

  // Duplicar para editar: um rascunho novo, sem as anotações (RN-28).
  await page.getByRole("button", { name: "Duplicar para editar" }).click();
  await expect(page).not.toHaveURL(quoteUrl);
  await expect(page.locator("h1").locator("..").getByText("Rascunho")).toBeVisible();
  await expect(page.getByLabel("Descrição do item 1")).toHaveValue("Logo");
});

test("o cliente recusa com o motivo, e o dono vê o motivo (F-08)", async ({ page, browser }) => {
  await useOwnIp(page);
  await newQuote(page, "senha-share-789");
  const quoteUrl = page.url();
  const link = await copyLink(page);

  const client = await clientPage(browser);
  await useOwnIp(client);
  await client.goto(link);
  await client.getByRole("button", { name: "Recusar" }).click();
  await client.getByRole("button", { name: "Preço" }).click();
  await client.getByLabel("Quer contar mais? (opcional)").fill("Acima do previsto.");
  await client.getByRole("button", { name: "Confirmar recusa" }).click();
  await expect(client.getByText(/Orçamento recusado\./)).toBeVisible();
  await client.context().close();

  await page.goto(quoteUrl);
  await expect(page.getByText(/^Recusado em .* · Motivo: Preço$/)).toBeVisible();
  await expect(page.getByText("“Acima do previsto.”")).toBeVisible();
});

test("editar um enviado oferece avisar o cliente no WhatsApp (F-10, RN-24)", async ({
  page,
  context,
}) => {
  const SENT = "Este orçamento já foi enviado. O cliente verá as alterações ao abrir o link.";
  await useOwnIp(page);
  await newQuote(page, "senha-share-321");
  // Rascunho: sem aviso.
  await expect(page.getByText(SENT)).toBeHidden();
  const link = await copyLink(page);
  await expect(page.getByText(SENT)).toBeVisible();

  // Uma alteração salva: o aviso muda e oferece o WhatsApp.
  await page.getByLabel("Valor do item 1 (R$)").fill("900");
  await expect(page.getByText("Orçamento atualizado.")).toBeVisible();

  await context.route("https://wa.me/**", (route) => route.fulfill({ body: "WhatsApp" }));
  const popup = context.waitForEvent("page");
  await page.getByRole("button", { name: "Avisar cliente no WhatsApp" }).click();
  const whatsApp = await popup;
  await whatsApp.waitForURL(/^https:\/\/wa\.me\//);
  expect(new URL(whatsApp.url()).searchParams.get("text")).toBe(
    `Olá! Atualizei o orçamento Nº 0001: ${link}`,
  );
  await whatsApp.close();

  // Avisado: volta ao texto inicial, e continua enviado.
  await expect(page.getByText(SENT)).toBeVisible();
  await expect(page.getByRole("button", { name: "Avisar cliente no WhatsApp" })).toBeHidden();
  await expect(page.locator("h1").locator("..").getByText("Enviado")).toBeVisible();
});
