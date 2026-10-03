import "server-only";

import { eq } from "drizzle-orm";

import { getProfile } from "@/features/profile/profile";
import { getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { accountDeletedEmail } from "@/lib/email/templates/account-deleted";
import { deleteObject } from "@/lib/storage";

// Exclusão de conta (F-17, RN-06, NBB-43), sem nada do Next. A ordem importa (E2):
//   1. apaga o logo no RustFS (ele não participa da cascata do banco);
//   2. apaga o usuário em auth.user (role app_auth) — a cascata leva sessões, contas de login
//      (senha e Google) e o perfil, e levará clientes, catálogo e orçamentos quando existirem.
// Se o logo não puder ser apagado, a conta fica intacta: nada sobra para trás (LGPD).
//   3. avisa por e-mail que a conta foi excluída (NBB-82).

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

  const [deleted] = await getAuthDb()
    .delete(user)
    .where(eq(user.id, userId))
    .returning({ email: user.email });
  if (deleted) {
    await sendDeletedNotice(deleted.email);
  }
  return { status: "deleted" };
}

/**
 * Aviso "Sua conta no Orçô foi excluída" (NBB-82). Sai depois da exclusão: se o envio falhar, a
 * conta continua excluída e o erro só vai para o log (X1-A, mesmo padrão do aviso de senha alterada).
 */
async function sendDeletedNotice(email: string): Promise<void> {
  try {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) throw new Error("Defina SITE_URL (veja .env.example).");
    await sendEmail(email, accountDeletedEmail({ siteUrl, email }));
  } catch (error) {
    console.error("Falha ao enviar o aviso de conta excluída.", error);
  }
}
