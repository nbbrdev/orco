import { expect, test, type Page } from "@playwright/test";

// Experimentar sem conta (NBB-95): o mini editor, a prévia como o cliente vê (lado a lado no
// computador, uma tela de cada vez no celular, E3-B) e a aprovação simulada (E4-A). Nada vai ao
// servidor (E5-A): o teste confere que nenhuma requisição sai da página durante o uso.

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

async function openPreview(page: Page) {
  if (isMobile(page)) {
    await page.getByRole("button", { name: "Ver como o cliente recebe" }).click();
  }
  return page.getByRole("region", { name: "Como o cliente recebe" });
}

test("montar um orçamento, ver como o cliente recebe e aprovar de mentira", async ({ page }) => {
  await page.goto("/experimentar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Experimente o Orçô sem criar conta",
  );

  // A partir daqui, nada do que a pessoa digita pode ir ao servidor: nenhum envio (POST, Server
  // Action). Os GET são os pré-carregamentos que o Next faz dos links da página.
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(`${request.method()} ${request.url()}`);
  });

  // E1-B: começa com um item de exemplo.
  const firstItem = page.getByRole("listitem", { name: "Item 1" });
  await expect(firstItem.getByLabel("Descrição")).toHaveValue("Criação de logotipo");

  await page.getByLabel("Seu nome ou da sua empresa (opcional)").fill("Estúdio Exemplo");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  const secondItem = page.getByRole("listitem", { name: "Item 2" });
  await secondItem.getByLabel("Descrição").fill("Manual de marca");
  await secondItem.getByLabel("Quantidade").fill("2");
  await secondItem.getByLabel("Valor (R$)").fill("225");
  await expect(page.getByRole("status").filter({ hasText: "R$ 1.250,00" })).toBeVisible();

  // Valor inválido: a mensagem do app de verdade, e o item sai da conta.
  await secondItem.getByLabel("Valor (R$)").fill("abc");
  await expect(secondItem.getByText("Informe um valor válido, ex.: 1.234,56")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "R$ 800,00" })).toBeVisible();
  await secondItem.getByLabel("Valor (R$)").fill("225");

  const preview = await openPreview(page);
  await expect(preview.getByText("Estúdio Exemplo")).toBeVisible();
  // .first(): a tabela do layout de computador fica no HTML, escondida (compact).
  await expect(preview.getByText("Manual de marca").first()).toBeVisible();
  await expect(preview.getByText("R$ 1.250,00")).toBeVisible();

  await preview.getByRole("button", { name: "Aprovar" }).click();
  await expect(preview.getByText(/Orçamento aprovado!/)).toBeVisible();
  await expect(preview.getByRole("link", { name: "Criar conta grátis" })).toHaveAttribute(
    "href",
    "/cadastro",
  );
  expect(requests).toEqual([]);

  // Recomeçar volta ao exemplo.
  await preview.getByRole("button", { name: "Experimentar de novo" }).click();
  await expect(page.getByRole("listitem", { name: "Item 2" })).toHaveCount(0);
  await expect(page.getByLabel("Seu nome ou da sua empresa (opcional)")).toHaveValue("");
});

test("recusar de mentira e, no celular, voltar para editar", async ({ page }) => {
  await page.goto("/experimentar");
  const preview = await openPreview(page);
  await preview.getByRole("button", { name: "Recusar" }).click();
  await expect(preview.getByText(/Orçamento recusado\./)).toBeVisible();

  if (isMobile(page)) {
    await preview.getByRole("button", { name: "Voltar e editar" }).click();
    await expect(page.getByRole("button", { name: "Ver como o cliente recebe" })).toBeVisible();
  }
});

test("a landing leva ao experimentar, que os buscadores podem ver (E6-A, E7-A)", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Experimentar sem conta" }).first().click();
  await expect(page).toHaveURL(/\/experimentar$/);

  expect(await (await request.get("/robots.txt")).text()).toContain("Allow: /experimentar");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/experimentar</loc>");
});
