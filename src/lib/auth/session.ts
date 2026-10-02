import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

/**
 * Para toda página e Server Action do /app (P5): devolve o usuário logado ou manda para o /entrar.
 * A checagem fica aqui, perto dos dados, e não no layout: o layout não roda de novo quando a pessoa
 * navega entre páginas (docs do Next 16, "Layouts and auth checks").
 *
 * `signInPath` troca o destino de quem não tem sessão. Só a lista de orçamentos usa: ela recebe o
 * link de confirmação vencido e precisa levar o aviso para o /entrar (F-01).
 */
export async function requireSessionUser(signInPath = "/entrar"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(signInPath);
  }
  return user;
}
