import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";

// Apoio dos testes E2E: leitura dos e-mails no Mailpit e uma conta pronta, criada pela própria tela.

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

/** Primeiro link do e-mail mais recente para `email` cujo texto casa com `pattern`. */
export async function linkFromMail(email: string, pattern: RegExp): Promise<string> {
  // O e-mail pode levar um instante: espera até ele chegar ao Mailpit.
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = (await (
      await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    ).json()) as { messages: { ID: string }[] };
    for (const { ID } of search.messages) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${ID}`)).json()) as {
        Text: string;
      };
      const link = pattern.exec(message.Text)?.[0];
      if (link) {
        return link;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`E-mail com ${pattern} para ${email} não chegou ao Mailpit.`);
}

/**
 * IP próprio por teste: os limites por IP (RN-46, recuperação) não atrapalham execuções repetidas. É
 * um IPv6 válido do bloco de documentação (2001:db8::/32), sorteado nos primeiros 64 bits, porque o
 * Better Auth agrupa IPv6 por /64 no limite dele.
 */
export async function useOwnIp(page: Page): Promise<void> {
  const [a, b] = randomUUID().split("-");
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `2001:db8:${a?.slice(0, 4)}:${b}::1` });
}

/** Cadastra pela tela e confirma pelo link do e-mail: termina logado em /app/orcamentos (F-01). */
export async function signUpAndConfirm(page: Page, password: string): Promise<string> {
  const email = `e2e-${randomUUID()}@example.com`;

  await page.goto("/cadastro");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await expect(page.getByText("Senha com pelo menos 8 caracteres")).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Se este e-mail puder ser usado")).toBeVisible();

  await page.goto(await linkFromMail(email, /https?:\/\/\S+verify-email\S+/));
  await expect(page).toHaveURL(/\/app\/orcamentos$/);
  return email;
}
