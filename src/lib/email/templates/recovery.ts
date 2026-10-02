import {
  button,
  type Email,
  fallbackLink,
  layout,
  note,
  paragraph,
  textVersion,
} from "@/lib/email/layout";

// "Redefina sua senha" (F-04). `url` é o link de redefinição gerado pelo Better Auth.
export function recoveryEmail({ siteUrl, url }: { siteUrl: string; url: string }): Email {
  const title = "Redefina sua senha";
  const intro =
    "Recebemos um pedido para redefinir a senha da sua conta no Orçô. Toque no botão abaixo para criar uma senha nova.";
  const expiry =
    "O link vale por 1 hora. Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.";

  return {
    subject: title,
    html: layout({
      siteUrl,
      title,
      body: [
        paragraph(intro),
        button(url, "Criar nova senha"),
        fallbackLink(url),
        note(expiry),
      ].join("\n                "),
    }),
    text: textVersion(title, [intro, `Criar nova senha: ${url}`, expiry]),
  };
}
