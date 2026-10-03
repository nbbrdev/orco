import { z } from "zod";

import { normalizeDocument } from "@/lib/document";
import { maskPhone } from "@/lib/masks";

// Validação e limpeza dos campos que se repetem entre o perfil (F-14) e os clientes (F-15): texto
// opcional, telefone, e-mail e CPF/CNPJ (RN-08). Texto vazio vira `null` (campo apagado).

/** Texto opcional: sem espaços nas pontas; vazio → null; limite de tamanho. */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((value) => value || null);
}

/**
 * Telefone brasileiro com DDD (RN-08, NBB-84 M7-A): 10 dígitos (fixo) ou 11 (celular), sem conferir
 * se o número existe. É guardado no formato da máscara: (11) 91234-5678.
 */
export function optionalPhone(max: number) {
  return optionalText(max)
    .refine(
      (value) =>
        value === null || (/^[0-9()\-\s]+$/.test(value) && /^\d{10,11}$/.test(digitsOf(value))),
      "Informe o telefone com DDD, ex.: (11) 91234-5678",
    )
    .transform((value) => (value === null ? null : maskPhone(value)));
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** E-mail (RN-08): só o formato; guardado em minúsculas. */
export function optionalEmail(max: number) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .max(max, `Use até ${max} caracteres.`)
    .transform((value) => value || null)
    .refine(
      (value) => value === null || z.email().safeParse(value).success,
      "Informe um e-mail válido.",
    );
}

/** A primeira mensagem de erro de cada campo de um formulário (ex.: clientes, catálogo). */
export function firstErrorByField<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as Field | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/** CPF/CNPJ (RN-08): guarda sem pontuação e confere o dígito verificador. */
export const optionalDocument = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) return null;
    const normalized = normalizeDocument(value);
    if (!normalized) {
      context.addIssue({ code: "custom", message: "CPF ou CNPJ inválido. Confira os números." });
      return z.NEVER;
    }
    return normalized;
  });
