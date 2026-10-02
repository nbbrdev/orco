import { escapeHtml } from "@/lib/email/escape";
import { button, type Email, layout, note, paragraph, textVersion } from "@/lib/email/layout";

// "Sua senha foi alterada" (aviso de segurança, NBB-37 / doc 02). Enviado a cada troca de senha, com o
// atalho "Não fui eu" para a recuperação.
export function passwordChangedEmail({
  siteUrl,
  email,
}: {
  siteUrl: string;
  email: string;
}): Email {
  const title = "Sua senha foi alterada";
  const resetUrl = `${siteUrl}/recuperar-senha`;
  const advice =
    "Se foi você, está tudo certo: não precisa fazer nada. Se não foi você, redefina sua senha agora para proteger sua conta.";
  const reason = "Por segurança, avisamos sempre que a senha da sua conta muda.";

  return {
    subject: title,
    html: layout({
      siteUrl,
      title,
      body: [
        paragraph(
          `A senha da conta <strong>${escapeHtml(email)}</strong> no Orçô acabou de ser alterada.`,
          16,
        ),
        paragraph(
          "Se foi você, está tudo certo: não precisa fazer nada. <strong>Se não foi você</strong>, redefina sua senha agora para proteger sua conta.",
        ),
        button(resetUrl, "Não fui eu: redefinir senha"),
        note(reason),
      ].join("\n                "),
    }),
    text: textVersion(title, [
      `A senha da conta ${email} no Orçô acabou de ser alterada.`,
      advice,
      `Não fui eu: redefinir senha: ${resetUrl}`,
      reason,
    ]),
  };
}
