// Máscaras dos campos de telefone e CPF/CNPJ (NBB-84), aplicadas enquanto a pessoa digita (M4-A).
// Funções puras: recebem o texto do campo e devolvem o texto formatado. O servidor valida de novo
// (src/lib/validation.ts), então a máscara só ajuda a digitar.

/** Encaixa os caracteres num padrão em que "#" é uma posição; o resto são separadores. */
function applyPattern(chars: string, pattern: string): string {
  let result = "";
  let index = 0;
  for (const slot of pattern) {
    if (index >= chars.length) break;
    if (slot === "#") {
      result += chars[index];
      index += 1;
    } else {
      result += slot;
    }
  }
  return result;
}

/**
 * Telefone brasileiro (M2-B): (11) 1234-5678 com 10 dígitos e (11) 91234-5678 com 11. Fica só com
 * os dígitos, no máximo 11.
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  return applyPattern(digits, digits.length <= 10 ? "(##) ####-####" : "(##) #####-####");
}

/**
 * CPF ou CNPJ no mesmo campo (M3-A): até 11 caracteres só com números, a máscara de CPF
 * (000.000.000-00); a partir do 12º, ou com alguma letra, a de CNPJ (00.000.000/0000-00). As letras
 * viram maiúsculas, por causa do CNPJ alfanumérico (RN-08).
 */
export function maskDocument(value: string): string {
  const chars = value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .slice(0, 14);
  const isCpf = chars.length <= 11 && /^\d*$/.test(chars);
  return applyPattern(chars, isCpf ? "###.###.###-##" : "##.###.###/####-##");
}

/** Quantas letras ou números há antes da posição `caret` (ignora os separadores). */
export function countSignificant(value: string, caret: number): number {
  return value.slice(0, caret).replace(/[^0-9A-Za-z]/g, "").length;
}

/**
 * Onde o cursor fica no texto formatado (M4-A): logo depois do mesmo número de letras ou números que
 * havia antes dele. Assim, corrigir o meio do campo não joga o cursor para o fim.
 */
export function caretAfterMask(formatted: string, significantBefore: number): number {
  if (significantBefore === 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/[0-9A-Za-z]/.test(formatted[index] ?? "")) {
      seen += 1;
      if (seen === significantBefore) return index + 1;
    }
  }
  return formatted.length;
}
