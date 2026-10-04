// Link do WhatsApp "click-to-chat" (F-06, F-07): abre o app (no celular) ou o WhatsApp Web, com a
// mensagem já escrita. Não há API nem envio pelo sistema: quem manda é a própria pessoa.

/**
 * `wa.me/55DDDNUMERO?text=…` quando há telefone; senão `wa.me/?text=…`, e a pessoa escolhe o contato.
 * O telefone vira só dígitos, com o 55 do Brasil quando tem 10 ou 11 dígitos (DDD + número).
 */
export function buildWhatsAppLink(phone: string | null, message: string): string {
  const text = `?text=${encodeURIComponent(message)}`;
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length === 10 || digits.length === 11) {
    return `https://wa.me/55${digits}${text}`;
  }
  if (digits.length >= 12) {
    return `https://wa.me/${digits}${text}`;
  }
  return `https://wa.me/${text}`;
}
