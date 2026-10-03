import { z } from "zod";

import { normalizeDocument } from "@/lib/document";

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

/** Telefone (RN-08): só o formato, sem conferir o número. */
export function optionalPhone(max: number) {
  return optionalText(max).refine(
    (value) => value === null || /^[0-9()+\-\s]{8,}$/.test(value),
    "Informe um telefone válido, ex.: (11) 91234-5678",
  );
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
