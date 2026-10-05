import { buildQuoteDocument, type QuoteDocumentModel } from "@/pdf/model";
import { addDays, todayInAppTimeZone } from "@/lib/dates";

// Orçamento de exemplo da landing (NBB-97 T2): dados fictícios, montados pelo mesmo
// buildQuoteDocument da página do cliente e do PDF, com a conta do money.ts (ADR-0006).

const NO_DISCOUNT = { type: null, value: 0 };

/** O exemplo como o cliente vê: emitido hoje, válido por 15 dias. */
export function sampleQuoteModel(now: Date = new Date()): QuoteDocumentModel {
  return buildQuoteDocument({
    profile: {
      businessName: "Marina Alves · Design",
      displayName: null,
      phone: null,
      contactEmail: null,
      website: null,
      instagram: null,
      document: null,
      paymentInfo: null,
    },
    logoPng: null,
    quote: {
      number: 12,
      status: "sent",
      sentAt: now,
      validUntil: addDays(todayInAppTimeZone(now), 15),
      client: null,
      items: [
        {
          id: "logo",
          description: "Criação de logotipo",
          quantityMilli: 1000,
          unit: null,
          unitPriceCents: 80000,
          catalogItemId: null,
          discount: NO_DISCOUNT,
        },
        {
          id: "manual",
          description: "Manual de marca",
          quantityMilli: 1000,
          unit: null,
          unitPriceCents: 45000,
          catalogItemId: null,
          discount: NO_DISCOUNT,
        },
      ],
      discount: NO_DISCOUNT,
      paymentTerms: "50% na aprovação e 50% na entrega",
      deliveryTime: null,
      notes: null,
    },
    now,
  });
}
