import "server-only";

import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

export type SessionUser = { id: string; email: string };

/**
 * Quem está logado nesta requisição, ou `null`. A sessão é conferida no banco a cada chamada (sem
 * cache em cookie): um logout ou uma sessão apagada valem na hora (docs/07-seguranca.md §2).
 *
 * É daqui que vem o `userId` do withUserDb: nunca de um valor enviado pelo navegador.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return { id: session.user.id, email: session.user.email };
}
