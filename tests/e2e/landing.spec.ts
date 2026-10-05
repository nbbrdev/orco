import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Landing (NBB-59, NBB-97): o caminho para o cadastro (F-01), o redirecionamento de quem já está
// logado (L2-A), a prévia do link (L3-B), o que os buscadores podem ver (L4-A) e as seções focadas no
// problema do freelancer.

test("a landing leva ao cadastro e ao login, com os documentos no rodapé", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Seus serviços, preços e clientes num só lugar/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Documentos legais" }).getByRole("link", {
      name: "Termos de uso",
    }),
  ).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/opengraph-image/,
  );

  await page.getByRole("link", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.goto("/");
  await page.getByRole("link", { name: "Começar grátis" }).first().click();
  await expect(page).toHaveURL(/\/cadastro$/);
});

test("a landing mostra o problema, o exemplo do cliente e as perguntas (NBB-97)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 2, name: "Se você se reconhece aqui, o Orçô é para você" }),
  ).toBeVisible();

  // O exemplo é a página do cliente de verdade, com o total do money.ts.
  const preview = page.getByRole("figure", { name: "Exemplo de orçamento como o cliente vê" });
  await expect(preview.getByText("Marina Alves · Design")).toBeVisible();
  await expect(preview.getByText("R$ 1.250,00")).toBeVisible();

  // As perguntas abrem sem JavaScript (<details>).
  await page.getByText("O meu cliente precisa criar conta?").click();
  await expect(page.getByText("Não. Ele só abre o link e aprova ou recusa.")).toBeVisible();
});

test("quem já está logado e abre a landing vai para o app (L2-A)", async ({ page }) => {
  await useOwnIp(page);
  await signUpAndConfirm(page, "senha-landing-123");
  await page.goto("/");
  await expect(page).toHaveURL(/\/app\/orcamentos$/);
});

test("os buscadores só veem a landing e os documentos legais (L4-A)", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app");
  expect(robots).toContain("Disallow: /p/");
  expect(robots).toContain("Sitemap:");

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/termos</loc>");
  expect(sitemap).not.toContain("/app");
});
