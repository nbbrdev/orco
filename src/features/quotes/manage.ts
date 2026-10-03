import "server-only";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { type CreateQuoteResult } from "@/features/quotes/quotes";
import { withUserDb } from "@/lib/db";
import { DB_ERROR_CODES, hasPostgresCode } from "@/lib/db/errors";
import { clients, profiles, quoteItems, quotes } from "@/lib/db/schema";
import { defaultValidUntil } from "@/lib/dates";

// Duplicar e excluir um orçamento (F-12, F-13, NBB-49), sem nada do Next. Sempre pelo withUserDb: a
// RLS garante que cada pessoa só alcança os próprios orçamentos. Prorrogar a validade (F-11) não
// precisa de função própria: o editor muda a validade e salva como qualquer outra alteração (P5-A).

const quoteId = z.uuid();

export type DuplicateQuoteResult = CreateQuoteResult | { status: "not_found" };

/**
 * Duplica um orçamento (RN-28, P2-A): um rascunho novo, com número novo, os mesmos itens, descontos,
 * condições, prazo e observações, e a validade recalculada a partir de hoje. O cliente vem do
 * cadastro atual (como ao escolher um cliente, RN-20); as anotações internas não são copiadas. Conta
 * no limite de 200 por mês (RN-38, P3).
 */
export async function duplicateQuote(userId: string, id: string): Promise<DuplicateQuoteResult> {
  if (!quoteId.safeParse(id).success) {
    return { status: "not_found" };
  }
  try {
    const created = await withUserDb(userId, async (tx) => {
      const [original] = await tx.select().from(quotes).where(eq(quotes.id, id));
      if (!original) {
        return null;
      }
      const [profile] = await tx
        .select({ validityDays: profiles.defaultValidityDays })
        .from(profiles)
        .where(eq(profiles.id, userId));
      if (!profile) {
        throw new Error("Perfil não encontrado para a conta da sessão.");
      }
      const [client] =
        original.clientId === null
          ? []
          : await tx
              .select({
                clientName: clients.name,
                clientEmail: clients.email,
                clientPhone: clients.phone,
                clientDocument: clients.document,
                clientAddress: clients.address,
              })
              .from(clients)
              .where(eq(clients.id, original.clientId));

      const [copy] = await tx
        .insert(quotes)
        .values({
          userId,
          clientId: original.clientId,
          // O cliente não pode ser excluído enquanto tiver orçamentos (RN-09), então o cadastro
          // existe; a cópia antiga só fica como garantia.
          clientName: client?.clientName ?? original.clientName,
          clientEmail: client ? client.clientEmail : original.clientEmail,
          clientPhone: client ? client.clientPhone : original.clientPhone,
          clientDocument: client ? client.clientDocument : original.clientDocument,
          clientAddress: client ? client.clientAddress : original.clientAddress,
          discountType: original.discountType,
          discountValue: original.discountValue,
          subtotalCents: original.subtotalCents,
          discountCents: original.discountCents,
          totalCents: original.totalCents,
          validUntil: defaultValidUntil(profile.validityDays),
          paymentTerms: original.paymentTerms,
          deliveryTime: original.deliveryTime,
          notes: original.notes,
        })
        .returning({ id: quotes.id });
      if (!copy) {
        throw new Error("O insert do orçamento não devolveu a linha.");
      }

      const items = await tx
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.quoteId, id))
        .orderBy(asc(quoteItems.position), asc(quoteItems.createdAt));
      if (items.length > 0) {
        await tx.insert(quoteItems).values(
          items.map((item, position) => ({
            userId,
            quoteId: copy.id,
            position,
            catalogItemId: item.catalogItemId,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            grossCents: item.grossCents,
            discountType: item.discountType,
            discountValue: item.discountValue,
            discountCents: item.discountCents,
            lineTotalCents: item.lineTotalCents,
          })),
        );
      }
      return copy.id;
    });
    return created === null ? { status: "not_found" } : { status: "created", id: created };
  } catch (error) {
    if (hasPostgresCode(error, DB_ERROR_CODES.monthlyQuoteLimit)) {
      return { status: "limit" };
    }
    throw error;
  }
}

/**
 * Exclui um orçamento em qualquer status (RN-29): os itens vão junto, e o link deixa de funcionar. O
 * número não é reaproveitado, e a vaga do mês não volta (RN-12, RN-38). `false` se não existe.
 */
export async function deleteQuote(userId: string, id: string): Promise<boolean> {
  if (!quoteId.safeParse(id).success) {
    return false;
  }
  const deleted = await withUserDb(userId, (tx) =>
    tx.delete(quotes).where(eq(quotes.id, id)).returning({ id: quotes.id }),
  );
  return deleted.length > 0;
}
