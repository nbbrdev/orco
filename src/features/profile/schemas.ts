import { z } from "zod";

import { PROFILE_LIMITS } from "@/lib/db/schema/profiles";
import { normalizeDocument } from "@/lib/document";

// Validação e limpeza de cada campo do perfil (F-14, NBB-42 D4). O salvamento é campo a campo (D3):
// o navegador manda um campo e o valor digitado, e o servidor valida de novo aqui. Texto vazio vira
// `null` (campo apagado), porque nada no perfil é obrigatório (RN-04).

/** Texto opcional: sem espaços nas pontas; vazio → null; limite de tamanho. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((value) => value || null);
}

/** Site (D4): sem `http(s)://`, acrescenta `https://`. Só aceita endereços web. */
const website = z
  .string()
  .trim()
  .max(PROFILE_LIMITS.website, `Use até ${PROFILE_LIMITS.website} caracteres.`)
  .transform((value) => {
    if (!value) return null;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  })
  .refine(
    (value) => value === null || isWebUrl(value),
    "Informe um endereço válido, ex.: meusite.com.br",
  );

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Instagram (D4): aceita `@fulano`, `fulano` ou o link do perfil; guarda `@fulano`. */
const instagram = z
  .string()
  .trim()
  .transform((value) => {
    if (!value) return null;
    const fromUrl = /instagram\.com\/([^/?#]+)/i.exec(value)?.[1];
    return `@${(fromUrl ?? value).replace(/^@/, "")}`;
  })
  .refine(
    (value) => value === null || /^@[A-Za-z0-9._]{1,30}$/.test(value),
    "Informe o usuário do Instagram, ex.: @meunegocio",
  );

/** Telefone (RN-08, D4): só o formato, sem conferir o número. */
const phone = optionalText(PROFILE_LIMITS.phone).refine(
  (value) => value === null || /^[0-9()+\-\s]{8,}$/.test(value),
  "Informe um telefone válido, ex.: (11) 91234-5678",
);

/** E-mail de contato (RN-08): só o formato. */
const contactEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(PROFILE_LIMITS.contactEmail)
  .transform((value) => value || null)
  .refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Informe um e-mail válido.",
  );

/** CPF/CNPJ (RN-08, D4): guarda sem pontuação e confere o dígito verificador. */
const document = z
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

/** Validade padrão em dias (RN-19): 1 a 365. */
const defaultValidityDays = z.coerce
  .number({ error: "Informe um número de dias." })
  .int("Use um número inteiro de dias.")
  .min(1, "A validade precisa ter pelo menos 1 dia.")
  .max(365, "A validade pode ter até 365 dias.");

/** Um schema por campo editável. A chave é o nome do campo no perfil. */
export const profileFieldSchemas = {
  displayName: optionalText(PROFILE_LIMITS.displayName),
  businessName: optionalText(PROFILE_LIMITS.businessName),
  phone,
  contactEmail,
  website,
  instagram,
  document,
  paymentInfo: optionalText(PROFILE_LIMITS.paymentInfo),
  defaultValidityDays,
  defaultNotes: optionalText(PROFILE_LIMITS.defaultNotes),
  defaultPaymentTerms: optionalText(PROFILE_LIMITS.defaultPaymentTerms),
  defaultDeliveryTime: optionalText(PROFILE_LIMITS.defaultDeliveryTime),
  emailNotifications: z.boolean(),
} as const;

export type ProfileField = keyof typeof profileFieldSchemas;
export type ProfileValues = { [K in ProfileField]: z.output<(typeof profileFieldSchemas)[K]> };

export const profileFieldSchema = z.enum(
  Object.keys(profileFieldSchemas) as [ProfileField, ...ProfileField[]],
);
