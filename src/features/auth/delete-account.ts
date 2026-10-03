import "server-only";

import { eq } from "drizzle-orm";

import { getProfile } from "@/features/profile/profile";
import { getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { deleteObject } from "@/lib/storage";

// Exclusão de conta (F-17, RN-06, NBB-43), sem nada do Next. A ordem importa (E2):
//   1. apaga o logo no RustFS (ele não participa da cascata do banco);
//   2. apaga o usuário em auth.user (role app_auth) — a cascata leva sessões, contas de login
//      (senha e Google) e o perfil, e levará clientes, catálogo e orçamentos quando existirem.
// Se o logo não puder ser apagado, a conta fica intacta: nada sobra para trás (LGPD).

/** O texto que a pessoa digita para confirmar (RN-06). */
export const DELETE_CONFIRMATION = "EXCLUIR";

export type DeleteAccountResult =
  { status: "deleted" } | { status: "unconfirmed" } | { status: "failed" };

export async function deleteAccount(
  userId: string,
  confirmation: unknown,
): Promise<DeleteAccountResult> {
  if (confirmation !== DELETE_CONFIRMATION) {
    return { status: "unconfirmed" };
  }

  const { logoPath } = await getProfile(userId);
  if (logoPath) {
    try {
      await deleteObject(logoPath);
    } catch (error) {
      console.error("Falha ao apagar o logo na exclusão da conta.", error);
      return { status: "failed" };
    }
  }

  await getAuthDb().delete(user).where(eq(user.id, userId));
  return { status: "deleted" };
}
