// CPF e CNPJ (RN-08, NBB-42 D4): validação pelo dígito verificador e formatação. Usado no perfil e,
// depois, nos clientes.
//
// O CNPJ aceita o formato alfanumérico da Receita (em vigor desde julho de 2026): 12 posições com
// letras ou números + 2 dígitos verificadores. Na conta, cada caractere vale o código dele menos 48
// ("0" = 0, …, "9" = 9, "A" = 17, …), então os CNPJs só com números continuam valendo como antes.

const CPF = /^[0-9]{11}$/;
const CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;

/**
 * Tira a pontuação, põe as letras em maiúsculas e confere o dígito verificador. Devolve o documento
 * limpo (como é guardado) ou `null` se for inválido.
 */
export function normalizeDocument(input: string): string | null {
  const value = input.replace(/[.\-/\s]/g, "").toUpperCase();
  if (CPF.test(value)) {
    return isValidCpf(value) ? value : null;
  }
  if (CNPJ.test(value)) {
    return isValidCnpj(value) ? value : null;
  }
  return null;
}

/** Formata para exibição: 000.000.000-00 (CPF) ou 00.000.000/0000-00 (CNPJ). */
export function formatDocument(value: string): string {
  if (value.length === 11) {
    return value.replace(/^(.{3})(.{3})(.{3})(.{2})$/, "$1.$2.$3-$4");
  }
  if (value.length === 14) {
    return value.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
  }
  return value;
}

/** Sequências repetidas (000…, 111…) passam na conta, mas não são documentos de verdade. */
function isRepeated(value: string): boolean {
  return /^(.)\1+$/.test(value);
}

function charValue(char: string): number {
  return char.charCodeAt(0) - 48;
}

function isValidCpf(cpf: string): boolean {
  if (isRepeated(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += charValue(cpf[i] ?? "0") * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === charValue(cpf[9] ?? "") && digit(10) === charValue(cpf[10] ?? "");
}

function isValidCnpj(cnpj: string): boolean {
  if (isRepeated(cnpj)) return false;
  const digit = (length: number) => {
    let sum = 0;
    let weight = length - 7;
    for (let i = 0; i < length; i++) {
      sum += charValue(cnpj[i] ?? "0") * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit(12) === charValue(cnpj[12] ?? "") && digit(13) === charValue(cnpj[13] ?? "");
}
