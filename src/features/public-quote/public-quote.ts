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

/** Respostas por minuto por IP e token (RN-39). */
export const RESPOND_LIMIT_PER_MINUTE = 5;

/** O que o cliente manda ao aprovar ou recusar (RN-33). Os textos são opcionais. */
export const respondSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approved"),
    /** A versão que a página mostrou (R2-A). */
    version: z.number().int().positive(),
    respondentName: z.string().trim().max(QUOTE_EVENT_LIMITS.respondentName).optional(),
  }),
  z.object({
    decision: z.literal("rejected"),
    version: z.number().int().positive(),
    reasonCode: z.enum(["price", "deadline", "gave_up", "other"]).optional(),
    reason: z.string().trim().max(QUOTE_EVENT_LIMITS.reason).optional(),
  }),
]);

export type RespondInput = z.input<typeof respondSchema>;

export type RespondResult =
  "ok" | "not_found" | "already_responded" | "expired" | "outdated" | "invalid" | "limit";

/**
 * Aprovar ou recusar pelo link (RN-32 a RN-34). A resposta é única; vale só para um orçamento
 * enviado, dentro da validade e na mesma versão que a página mostrou (R2-A). Registra IP, navegador
 * e a versão (RN-34).
 */
export async function respondToQuote(
  token: string,
  input: unknown,
  ip: string,
  userAgent: string | null,
): Promise<RespondResult> {
  if (!tokenSchema.safeParse(token).success) {
    return "not_found";
  }
  const parsed = respondSchema.safeParse(input);
  if (!parsed.success) {
    return "invalid";
  }
  if (!(await checkRateLimit(`respond:${ip}:${token}`, RESPOND_LIMIT_PER_MINUTE, 60))) {
    return "limit";
  }
  const answer = parsed.data;
  const validIp = ipSchema.safeParse(ip).success ? ip : null;
  const agent = userAgent ? userAgent.slice(0, QUOTE_EVENT_LIMITS.userAgent) : null;
  const name = answer.decision === "approved" ? answer.respondentName || null : null;
  const reasonCode = answer.decision === "rejected" ? (answer.reasonCode ?? null) : null;
  const reason = answer.decision === "rejected" ? answer.reason || null : null;

  const rows = await getAppDb().execute<{ result: string }>(
    sql`select app.respond_to_quote(
      ${token}, ${answer.decision}::public.quote_event_type, ${answer.version}, ${name},
      ${reasonCode}::public.reject_reason, ${reason}, ${validIp}::inet, ${agent}
    ) as result`,
  );
  return rows[0]?.result as RespondResult;
}

/** Apaga o IP dos eventos com mais de 12 meses (RN-37). Chamada pelo agendamento diário (NBB-62). */
export async function anonymizeOldEventIps(): Promise<number> {
  const rows = await getAppDb().execute<{ changed: number }>(
    sql`select app.anonymize_old_event_ips() as changed`,
  );
  return rows[0]?.changed ?? 0;
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
