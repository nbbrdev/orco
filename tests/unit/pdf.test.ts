import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { logoToPng } from "@/pdf/logo";
import { buildQuoteDocument } from "@/pdf/model";
import { renderQuotePdf } from "@/pdf/render";

import { completeQuote, EMPTY_PROFILE, longQuote, minimalQuote, pdfItem } from "./pdf-fixtures";

// O PDF do orçamento (RF-27, NBB-50): o que entra nele (RN-04, RN-15b, N4-A), a conversão do logo
// (N1-A) e a geração. Com `npm run pdf:sample` (modo pdf-sample), também grava os exemplos em
// pdf-samples/ para revisar o visual (N3-A).

// Um logo de exemplo em WebP, como os guardados (RN-05).
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <circle cx="256" cy="256" r="240" fill="#7c3aed"/>
  <rect x="156" y="156" width="200" height="200" rx="40" fill="#ffffff"/>
</svg>`;

let logoPng: Uint8Array | null = null;

beforeAll(async () => {
  logoPng = await logoToPng(await sharp(Buffer.from(LOGO_SVG)).webp().toBuffer());
});

describe("buildQuoteDocument", () => {
  it("monta o orçamento completo: emissor, cliente, linhas e totais (exemplo da RN-16)", () => {
    const model = buildQuoteDocument(completeQuote(null));
    expect(model.issuer).toEqual({
      name: "Estúdio Exemplo de Design",
      contacts: [
        "(11) 91234-5678",
        "contato@example.com",
        "example.com",
        "@estudioexemplo",
        "11.222.333/0001-81",
      ],
      logoPng: null,
    });
    expect(model).toMatchObject({
      number: "0012",
      issuedAt: "02/10/2026",
      validUntil: "18/10/2026",
      client: {
        name: "Maria da Conceição Exemplo",
        contacts: ["(21) 98765-4321", "maria@example.com", "529.982.247-25"],
        address: "Rua das Acácias, 123, apto. 45 — Bairro Exemplo, São Paulo/SP",
      },
      showItemDiscount: true,
      paymentTerms: "50% na aprovação, 50% na entrega.",
      deliveryTime: "15 dias úteis após a aprovação.",
      paymentInfo: "Pix: contato@example.com · Banco Exemplo, agência 0001, conta 12345-6",
    });
    expect(model.lines[0]).toMatchObject({
      quantity: "1",
      unit: "un",
      discount: "−10%",
    });
    expect(model.lines[0]?.total).toMatch(/^R\$\s720,00$/u);
    expect(model.lines[1]?.discount).toBe("");
    expect(model.totals).toEqual({
      subtotal: expect.stringMatching(/^R\$\s2\.720,00$/u),
      discount: expect.stringMatching(/^−R\$\s220,00$/u),
      total: expect.stringMatching(/^R\$\s2\.500,00$/u),
    });
  });

  it("no mínimo: sem nome, sem cliente, valor em branco, só o total (RN-04, RN-15b, D3-B)", () => {
    const model = buildQuoteDocument(minimalQuote());
    expect(model.issuer).toEqual({ name: null, contacts: [], logoPng: null });
    expect(model.client).toBeNull();
    expect(model.showItemDiscount).toBe(false);
    expect(model.lines[0]).toMatchObject({ unit: "", unitPrice: "—" });
    expect(model.totals).toEqual({ total: expect.stringMatching(/^R\$\s0,00$/u) });
  });

  it("o nome segue a ordem da RN-04: comercial → de exibição → e-mail de contato (D3-B)", () => {
    const input = minimalQuote();
    input.profile = { ...EMPTY_PROFILE, displayName: "Joana", contactEmail: "oi@example.com" };
    expect(buildQuoteDocument(input).issuer).toMatchObject({
      name: "Joana",
      contacts: ["oi@example.com"],
    });

    // Só o e-mail de contato: ele vira o nome e não se repete nos contatos.
    input.profile = { ...EMPTY_PROFILE, contactEmail: "oi@example.com", phone: "(11) 91234-5678" };
    expect(buildQuoteDocument(input).issuer).toMatchObject({
      name: "oi@example.com",
      contacts: ["(11) 91234-5678"],
    });
  });

  it("emitido em: data do envio; no rascunho, hoje (N4-A)", () => {
    const draft = minimalQuote();
    draft.now = new Date("2026-10-05T02:00:00Z"); // ainda 04/10 em São Paulo
    expect(buildQuoteDocument(draft).issuedAt).toBe("04/10/2026");

    const sent = completeQuote(null);
    sent.quote.sentAt = null;
    expect(buildQuoteDocument(sent).issuedAt).toBe("03/10/2026");
  });

  it("desconto em R$ do item aparece como valor, e o cliente sem contatos fica só com o nome", () => {
    const input = completeQuote(null);
    input.quote.items = [pdfItem("Ajuste", 1000, null, 5000, { type: "amount", value: 8000 })];
    input.quote.discount = { type: null, value: 0 };
    input.quote.client = {
      name: "Fulano",
      email: null,
      phone: null,
      document: null,
      address: null,
    };
    const model = buildQuoteDocument(input);
    // Limitado ao valor da linha (RN-15a).
    expect(model.lines[0]?.discount).toMatch(/^−R\$\s50,00$/u);
    expect(model.client).toEqual({ name: "Fulano", contacts: [], address: null });
    expect("subtotal" in model.totals).toBe(false);
  });
});

describe("logoToPng (N1-A)", () => {
  it("converte o WebP em PNG e devolve nulo para um arquivo que não é imagem", async () => {
    const png = logoPng ?? new Uint8Array();
    // Assinatura do PNG: 89 50 4E 47.
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(await logoToPng(new TextEncoder().encode("não é imagem"))).toBeNull();
  });
});

describe("renderQuotePdf", () => {
  const samples = {
    completo: () => completeQuote(logoPng),
    minimo: () => minimalQuote(),
    longo: () => longQuote(logoPng),
  };

  for (const [name, input] of Object.entries(samples)) {
    it(`gera o PDF ${name}`, async () => {
      const pdf = await renderQuotePdf(input());
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
      if (import.meta.env.MODE === "pdf-sample") {
        mkdirSync("pdf-samples", { recursive: true });
        writeFileSync(`pdf-samples/orcamento-${name}.pdf`, pdf);
      }
    }, 30_000);
  }
});
