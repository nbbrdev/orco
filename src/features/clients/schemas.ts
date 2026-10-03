import { z } from "zod";

import { CLIENT_LIMITS } from "@/lib/db/schema/clients";
import { optionalDocument, optionalEmail, optionalPhone, optionalText } from "@/lib/validation";

// Validação e limpeza do formulário de cliente (F-15, NBB-44). Só o nome é obrigatório (RN-07); o
// resto vazio vira `null`. O navegador manda o que foi digitado, e o servidor valida de novo aqui.

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do cliente.")
    .max(CLIENT_LIMITS.name, `Use até ${CLIENT_LIMITS.name} caracteres.`),
  email: optionalEmail(CLIENT_LIMITS.email),
  phone: optionalPhone(CLIENT_LIMITS.phone),
  document: optionalDocument,
  address: optionalText(CLIENT_LIMITS.address),
  internalNotes: optionalText(CLIENT_LIMITS.internalNotes),
});

export type ClientInput = z.input<typeof clientSchema>;
export type ClientValues = z.output<typeof clientSchema>;
export type ClientField = keyof ClientValues;

/** Um cliente como a tela recebe: os campos e o id. */
export type ClientRow = ClientValues & { id: string };
