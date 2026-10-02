import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

// F-01 de ponta a ponta: cadastrar → abrir o link do e-mail (lido no Mailpit) → entrar logado.

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

async function confirmationLink(email: string): Promise<string> {
  // O e-mail sai em segundo plano: espera até ele chegar ao Mailpit.
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = (await (
      await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    ).json()) as { messages: { ID: string }[] };
    const id = search.messages[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)).json()) as {
        Text: string;
      };
      const link = /https?:\/\/\S+verify-email\S+/.exec(message.Text)?.[0];
      if (link) {
        return link;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`E-mail de confirmação para ${email} não chegou ao Mailpit.`);
}

test("cadastro com e-mail e senha, confirmação e entrada logada (F-01)", async ({ page }) => {
  // IP próprio por teste: o limite de 3 cadastros por IP (RN-46) não atrapalha execuções repetidas.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${Date.now() % 250}` });
  const email = `e2e-${randomUUID()}@example.com`;

  await page.goto("/cadastro");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-e2e-1234");
  await expect(page.getByText("Senha com pelo menos 8 caracteres")).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByText("Se este e-mail puder ser usado")).toBeVisible();

  await page.goto(await confirmationLink(email));

  await expect(page).toHaveURL(/\/app\/orcamentos$/);
  await expect(page.getByRole("heading", { name: `Você entrou como ${email}` })).toBeVisible();
});

test("link de confirmação inválido leva ao login com aviso (F-01)", async ({ page }) => {
  await page.goto("/api/auth/verify-email?token=invalido&callbackURL=/app/orcamentos");

  await expect(page).toHaveURL(/\/entrar\?aviso=link-invalido$/);
  await expect(page.getByText("Este link expirou ou já foi usado")).toBeVisible();
});
