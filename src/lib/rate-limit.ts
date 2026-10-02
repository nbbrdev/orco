import "server-only";

import { sql } from "drizzle-orm";

import { getAppDb } from "@/lib/db";

/**
 * Conta mais um uso de `key` e diz se ainda está dentro do limite (ADR-0004). Janela fixa no relógio
 * de São Paulo: `windowSeconds = 3600` vira a cada hora cheia; `86400`, à meia-noite de Brasília.
 *
 * A contagem fica no Postgres (`public.rate_limits`, acessível só pela função), então sobrevive a
 * reinícios e deploys.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const rows = await getAppDb().execute<{ allowed: boolean }>(
    sql`select app.check_rate_limit(${key}, ${limit}, ${windowSeconds}) as allowed`,
  );
  return rows[0]?.allowed === true;
}
