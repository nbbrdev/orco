import { escapeHtml } from "@/lib/email/escape";

// Moldura comum dos e-mails de conta, idêntica ao HTML aprovado na NBB-37: logo à esquerda do nome,
// cartão branco, botão teal e rodapé "Esta caixa não recebe respostas". Estilos inline e tabelas,
// porque muitos clientes de e-mail ignoram CSS em <style>.

export type Email = { subject: string; html: string; text: string };

const FOOTER = "Orçô · orçamentos simples para freelancers. Esta caixa não recebe respostas.";

/** Parágrafo do corpo. `html` já precisa estar escapado. */
export function paragraph(html: string, marginBottom = 24): string {
  return `<p style="margin: 0 0 ${marginBottom}px 0; font-size: 16px; line-height: 24px; color: #10201e">${html}</p>`;
}

/** Nota menor, em cinza. `html` já precisa estar escapado. */
export function note(html: string): string {
  return `<p style="margin: 0 0 24px 0; font-size: 14px; line-height: 20px; color: #51615f">${html}</p>`;
}

/** Botão teal. */
export function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius: 8px; background-color: #0f766e">
                      <a href="${escapeHtml(url)}" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none">${escapeHtml(label)}</a>
                    </td>
                  </tr>
                </table>`;
}

/** "Se o botão não funcionar, copie e cole este link no navegador:" + o link por extenso. */
export function fallbackLink(url: string): string {
  const safeUrl = escapeHtml(url);
  return `<p style="margin: 24px 0 8px 0; font-size: 14px; line-height: 20px; color: #51615f">Se o botão não funcionar, copie e cole este link no navegador:</p>
                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 20px; word-break: break-all">
                  <a href="${safeUrl}" style="color: #0f766e">${safeUrl}</a>
                </p>`;
}

export function layout({
  siteUrl,
  title,
  body,
}: {
  siteUrl: string;
  title: string;
  /** HTML do corpo, já montado com as funções acima. */
  body: string;
}): string {
  const logoUrl = escapeHtml(`${siteUrl}/email/logo.png`);
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f6f8f8; font-family: Arial, Helvetica, sans-serif; color: #10201e">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f8f8">
      <tr>
        <td align="center" style="padding: 32px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border: 1px solid #d6dfdd; border-radius: 12px">
            <tr>
              <td style="padding: 32px 32px 8px 32px">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right: 12px; vertical-align: middle"><img src="${logoUrl}" width="40" height="40" alt="" style="display: block; border: 0" /></td>
                    <td style="vertical-align: middle"><p style="margin: 0; font-size: 24px; font-weight: bold; color: #0f766e">Orçô</p></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 0 32px">
                <h1 style="margin: 0 0 16px 0; font-size: 20px; line-height: 28px; color: #10201e">${escapeHtml(title)}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 32px 32px; border-top: 1px solid #d6dfdd">
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #51615f">${FOOTER}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/** Versão em texto puro: título, parágrafos separados por linha em branco e o rodapé. */
export function textVersion(title: string, paragraphs: string[]): string {
  return [title, ...paragraphs, "--", FOOTER].join("\n\n") + "\n";
}
