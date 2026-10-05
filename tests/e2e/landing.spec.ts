import { expect, test } from "@playwright/test";

import { signUpAndConfirm, useOwnIp } from "./helpers";

// Landing (NBB-59): o caminho para o cadastro (F-01), o redirecionamento de quem já está logado (L2-A),
// a prévia do link (L3-B) e o que os buscadores podem ver (L4-A).

test("a landing leva ao cadastro e ao login, com os documentos no rodapé", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Orçamentos simples para freelancers." }),
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
  await page.getByRole("link", { name: "Começar grátis" }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
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
