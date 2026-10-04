import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";

import type { ParsedItem } from "@/features/quotes/items";
import { loadLogoPng } from "@/features/quotes/pdf";
import { getAppDb } from "@/lib/db";
import { QUOTE_EVENT_LIMITS } from "@/lib/db/schema/quote-events";
import { numericToQuantity } from "@/lib/money";
import { checkRateLimit } from "@/lib/rate-limit";
import { quotePdfFileName } from "@/pdf/file-name";
import type { QuoteDocumentInput } from "@/pdf/model";
import { renderQuotePdf } from "@/pdf/render";

// O orçamento pelo link público (ADR-0005, ADR-0014, NBB-52). O cliente final não tem conta: o
// servidor chama as funções `SECURITY DEFINER` da migration 0009 pela app_user, sem withUserDb, e elas
// só alcançam o orçamento do token. Nada daqui roda no navegador.

/** Formato do token (RN-30): 32 bytes em base64url, 43 caracteres. */
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const discountSchema = {
  discountType: z.enum(["percent", "amount"]).nullable(),
  discountValue: z.number().int().nonnegative(),
};

// O JSON de app.get_public_quote (D4-A). Conferido aqui para o resto do código confiar nos tipos.
const publicQuoteSchema = z.object({
  number: z.number().int().positive(),
  status: z.enum(["sent", "approved", "rejected"]),
  version: z.number().int().positive(),
  validUntil: z.iso.date(),
  sentAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  client: z
    .object({
      name: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      document: z.string().nullable(),
      address: z.string().nullable(),
    })
    .nullable(),
  ...discountSchema,
  paymentTerms: z.string().nullable(),
  deliveryTime: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.string(),
      unit: z.string().nullable(),
      unitPriceCents: z.number().int().nonnegative().nullable(),
      ...discountSchema,
    }),
  ),
  issuer: z.object({
    businessName: z.string().nullable(),
    displayName: z.string().nullable(),
    phone: z.string().nullable(),
    contactEmail: z.string().nullable(),
    website: z.string().nullable(),
    instagram: z.string().nullable(),
    document: z.string().nullable(),
    paymentInfo: z.string().nullable(),
    logoPath: z.string().nullable(),
  }),
});

type RawPublicQuote = z.infer<typeof publicQuoteSchema>;

export type PublicQuote = Omit<RawPublicQuote, "sentAt" | "respondedAt" | "items"> & {
  sentAt: Date | null;
  respondedAt: Date | null;
  items: ParsedItem[];
};

/**
 * O orçamento do link (RN-31): só enviado, aprovado ou recusado. Rascunho, excluído e token inválido
 * dão o mesmo `null`, para não revelar se um token existe. Só lê: não conta visualização (D2-A).
 */
export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  if (!tokenSchema.safeParse(token).success) {
    return null;
  }
  const rows = await getAppDb().execute<{ quote: unknown }>(
    sql`select app.get_public_quote(${token}) as quote`,
  );
  const raw = rows[0]?.quote;
  if (raw === null || raw === undefined) {
    return null;
  }
  const quote = publicQuoteSchema.parse(raw);
  return {
    ...quote,
    sentAt: quote.sentAt ? new Date(quote.sentAt) : null,
    respondedAt: quote.respondedAt ? new Date(quote.respondedAt) : null,
    items: quote.items.map((item, index) => ({
      id: String(index),
      description: item.description,
      quantityMilli: numericToQuantity(item.quantity),
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      catalogItemId: null,
      discount: { type: item.discountType, value: item.discountValue },
    })),
  };
}

const ipSchema = z.union([z.ipv4(), z.ipv6()]);

/**
 * Conta uma visualização do link (RN-35, D2-A). A página chama só quando quem abre não é robô de
 * pré-visualização nem o dono logado. Devolve `true` na primeira visualização. O IP só é gravado se
 * for um IP de verdade (sem o Nginx, ex.: `npm run dev`, chega "unknown").
 */
export async function registerQuoteView(
  token: string,
  ip: string,
  userAgent: string | null,
): Promise<boolean> {
  if (!tokenSchema.safeParse(token).success) {
    return false;
  }
  const validIp = ipSchema.safeParse(ip).success ? ip : null;
  const agent = userAgent ? userAgent.slice(0, QUOTE_EVENT_LIMITS.userAgent) : null;
  const rows = await getAppDb().execute<{ first: boolean }>(
    sql`select app.register_quote_view(${token}, ${validIp}::inet, ${agent}) as first`,
  );
  return rows[0]?.first === true;
}

/** PDFs públicos por minuto por IP (RN-39, D7). */
export const PUBLIC_PDF_LIMIT_PER_MINUTE = 10;

export type PublicPdfResult =
  | { status: "ok"; bytes: Uint8Array; fileName: string }
  | { status: "limit" }
  | { status: "not_found" };

/** O que o modelo do PDF precisa, a partir do orçamento público. */
export async function publicPdfInput(quote: PublicQuote): Promise<QuoteDocumentInput> {
  const { issuer } = quote;
  return {
    profile: issuer,
    logoPng: await loadLogoPng(issuer.logoPath),
    quote: {
      number: quote.number,
      status: quote.status,
      sentAt: quote.sentAt,
      validUntil: quote.validUntil,
      client: quote.client,
      items: quote.items,
      discount: { type: quote.discountType, value: quote.discountValue },
      paymentTerms: quote.paymentTerms,
      deliveryTime: quote.deliveryTime,
      notes: quote.notes,
    },
    now: new Date(),
  };
}

/** O PDF do link público (D7): o mesmo modelo do PDF do dono, sem contar visualização. */
export async function renderPublicPdf(token: string, ip: string): Promise<PublicPdfResult> {
  if (!(await checkRateLimit(`pdf:ip:${ip}`, PUBLIC_PDF_LIMIT_PER_MINUTE, 60))) {
    return { status: "limit" };
  }
  const quote = await getPublicQuote(token);
  if (!quote) {
    return { status: "not_found" };
  }
  return {
    status: "ok",
    bytes: await renderQuotePdf(await publicPdfInput(quote)),
    fileName: quotePdfFileName(quote.number, quote.client?.name ?? null),
  };
}
