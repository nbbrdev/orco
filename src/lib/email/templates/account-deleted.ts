import { escapeHtml } from "@/lib/email/escape";
import { type Email, layout, note, paragraph, textVersion } from "@/lib/email/layout";

// "Sua conta no Orçô foi excluída" (aviso de segurança, NBB-82). Enviado depois da exclusão (F-17).
// Sem botão: a conta não existe mais, então não há para onde levar a pessoa.
export function accountDeletedEmail({ siteUrl, email }: { siteUrl: string; email: string }): Email {
  const title = "Sua conta no Orçô foi excluída";
  const deleted =
    "junto com todos os dados dela: perfil, logo, clientes, catálogo e orçamentos. Os links de orçamento enviados deixaram de funcionar. Não dá para recuperar.";
  const itWasYou = "Se foi você, não precisa fazer nada. Obrigado por ter usado o Orçô.";
  const notYou =
    "Troque a senha do seu e-mail (e a da sua conta Google, se usava o Google para entrar).";

  return {
    subject: title,
    html: layout({
      siteUrl,
      title,
      body: [
        paragraph(
          `A conta <strong>${escapeHtml(email)}</strong> no Orçô foi excluída agora, ${deleted}`,
          16,
        ),
        paragraph(itWasYou, 16),
        note(`<strong>Se não foi você</strong>, alguém entrou na sua conta. ${notYou}`),
      ].join("\n                "),
    }),
    text: textVersion(title, [
      `A conta ${email} no Orçô foi excluída agora, ${deleted}`,
      itWasYou,
      `Se não foi você, alguém entrou na sua conta. ${notYou}`,
    ]),
  };
}
