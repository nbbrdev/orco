import { z } from "zod";

// Schemas do cadastro e do login (F-01, F-03). Os mesmos valem no navegador (React Hook Form) e no
// servidor (Server Actions): a validação do navegador é só conforto; a que conta é a do servidor.

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail longo demais.")
  .pipe(z.email("Informe um e-mail válido."));

export const PASSWORD_MIN_LENGTH = 8;

export const signUpSchema = z.object({
  email,
  // RN-03: mínimo de 8 caracteres, sem exigência de tipos. O máximo só evita abuso (hash de textos
  // gigantes).
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(128, "A senha pode ter até 128 caracteres."),
  // Campo "isca" (honeypot, RN-46): invisível para pessoas. Qualquer valor = robô.
  website: z.string().max(200).optional(),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha.").max(128),
});

export const resendSchema = z.object({ email });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
