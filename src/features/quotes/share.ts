import { formatQuoteNumber } from "@/features/quotes/items";

// Compartilhar o orçamento (F-06, NBB-54): o endereço do link público e a mensagem do WhatsApp. O
// endereço usa a origem da própria página, então funciona igual no staging e na produção (C3-A).

/** Depois do "Gerar novo link" (F-13, RN-36, C5-A). */
export const NEW_LINK_NOTICE = "Novo link gerado. O anterior não funciona mais.";
export const NEW_LINK_FAILED_MESSAGE = "Não foi possível gerar um novo link. Tente de novo.";

/** Quando o navegador não deixa copiar: o link aparece para copiar à mão (C3-A). */
export function copyFailedMessage(url: string): string {
  return `Não foi possível copiar o link. Copie à mão: ${url}`;
}

/** "https://orco.nbbrdev.com/p/<token>". */
export function publicQuoteUrl(origin: string, token: string): string {
  return `${origin}/p/${token}`;
}

/** A mensagem já escrita do WhatsApp (F-06): "Olá! Segue o orçamento Nº 0001: <link>". */
export function shareMessage(quoteNumber: number, url: string): string {
  return `Olá! Segue o orçamento Nº ${formatQuoteNumber(quoteNumber)}: ${url}`;
}

/**
 * Copia para a área de transferência. Precisa ser chamada logo no toque: depois de esperar o servidor,
 * o Safari recusa (C3-A). Devolve se deu certo.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
