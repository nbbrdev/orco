import {
  button,
  type Email,
  fallbackLink,
  layout,
  note,
  paragraph,
  textVersion,
} from "@/lib/email/layout";

// "Confirme seu e-mail" (F-01, RN-02). `url` é o link de confirmação gerado pelo Better Auth.
export function confirmationEmail({ siteUrl, url }: { siteUrl: string; url: string }): Email {
  const title = "Confirme seu e-mail";
  const intro =
    "Falta um passo para ativar sua conta no Orçô. Toque no botão abaixo para confirmar este endereço de e-mail.";
  const expiry = "O link vale por 1 hora. Se você não criou uma conta no Orçô, ignore este e-mail.";

  return {
    subject: title,
    html: layout({
      siteUrl,
      title,
      body: [
        paragraph(intro),
        button(url, "Confirmar e-mail"),
        fallbackLink(url),
        note(expiry),
      ].join("\n                "),
    }),
    text: textVersion(title, [intro, `Confirmar e-mail: ${url}`, expiry]),
  };
}
