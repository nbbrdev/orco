import type { ParsedItem } from "@/features/quotes/items";
import type { QuoteDocumentInput } from "@/pdf/model";

// Orçamentos de exemplo para o PDF (NBB-50): os testes e o `npm run pdf:sample` usam os mesmos.
// Todos os dados são inventados (repo público: nada de dados reais).

let nextId = 0;

export function pdfItem(
  description: string,
  quantityMilli: number,
  unit: string | null,
  unitPriceCents: number | null,
  discount: ParsedItem["discount"] = { type: null, value: 0 },
): ParsedItem {
  return {
    id: String(++nextId),
    description,
    quantityMilli,
    unit,
    unitPriceCents,
    catalogItemId: null,
    discount,
  };
}

export const EMPTY_PROFILE: QuoteDocumentInput["profile"] = {
  businessName: null,
  displayName: null,
  phone: null,
  contactEmail: null,
  website: null,
  instagram: null,
  document: null,
  paymentInfo: null,
};

const NOW = new Date("2026-10-03T15:00:00Z");

/** Tudo preenchido: logo, cliente, descontos do item e geral, condições, prazo e observações. */
export function completeQuote(logoPng: Uint8Array | null): QuoteDocumentInput {
  return {
    profile: {
      businessName: "Estúdio Exemplo de Design",
      displayName: "Joana Exemplo",
      phone: "(11) 91234-5678",
      contactEmail: "contato@example.com",
      website: "https://example.com",
      instagram: "@estudioexemplo",
      document: "11222333000181",
      paymentInfo: "Pix: contato@example.com · Banco Exemplo, agência 0001, conta 12345-6",
    },
    logoPng,
    quote: {
      number: 12,
      status: "sent",
      sentAt: new Date("2026-10-02T15:00:00Z"),
      validUntil: "2026-10-18",
      client: {
        name: "Maria da Conceição Exemplo",
        email: "maria@example.com",
        phone: "(21) 98765-4321",
        document: "52998224725",
        address: "Rua das Acácias, 123, apto. 45 — Bairro Exemplo, São Paulo/SP",
      },
      items: [
        pdfItem("Criação de logotipo com três propostas e ajustes", 1000, "un", 80000, {
          type: "percent",
          value: 1000,
        }),
        pdfItem("Site institucional (5 páginas, responsivo)", 1000, "un", 200000),
      ],
      discount: { type: "amount", value: 22000 },
      paymentTerms: "50% na aprovação, 50% na entrega.",
      deliveryTime: "15 dias úteis após a aprovação.",
      notes: "Valores sem impostos.\nInclui até duas rodadas de ajustes por entrega.",
    },
    now: NOW,
  };
}

/** O mínimo: perfil vazio, sem cliente, um item sem valor (rascunho), sem descontos nem textos. */
export function minimalQuote(): QuoteDocumentInput {
  return {
    profile: EMPTY_PROFILE,
    logoPng: null,
    quote: {
      number: 1,
      status: "draft",
      sentAt: null,
      validUntil: "2026-10-18",
      client: null,
      items: [pdfItem("Serviço avulso", 1000, null, null)],
      discount: { type: null, value: 0 },
      paymentTerms: null,
      deliveryTime: null,
      notes: null,
    },
    now: NOW,
  };
}

/** Muitos itens, para ver a quebra de página (o cabeçalho da tabela se repete). */
export function longQuote(logoPng: Uint8Array | null): QuoteDocumentInput {
  const complete = completeQuote(logoPng);
  return {
    ...complete,
    quote: {
      ...complete.quote,
      number: 37,
      items: Array.from({ length: 45 }, (_, index) =>
        pdfItem(`Item ${index + 1}: hora de desenvolvimento e acompanhamento`, 2000, "h", 12000),
      ),
      discount: { type: "percent", value: 500 },
    },
  };
}
