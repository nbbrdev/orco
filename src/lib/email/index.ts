import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { Email } from "@/lib/email/layout";

// Envio de e-mail por SMTP (ADR-0016, NBB-80). Um caminho só em todos os ambientes; muda o destino:
//   local: Mailpit (compose.dev.yaml, http://localhost:8025), nada sai do PC;
//   staging/produção: smtp.resend.com:465, com a API key do Resend como senha.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Defina ${name} (veja .env.example).`);
  }
  return value;
}

function createTransport(): Transporter {
  const port = Number(requireEnv("SMTP_PORT"));
  const user = process.env.SMTP_USER;
  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port,
    // 465 = TLS desde o início (Resend). Outras portas (Mailpit: 1025) sem criptografia.
    secure: port === 465,
    // O Mailpit não pede login; o Resend sim (usuário "resend", senha = API key).
    auth: user ? { user, pass: requireEnv("SMTP_PASSWORD") } : undefined,
  });
}

// Criado na primeira chamada, como o getAuth(): o build não tem o .env.
let transporter: Transporter | undefined;

/**
 * Envia um e-mail montado por um template (`src/lib/email/templates`). Lança erro se o envio falhar:
 * quem chama decide o que fazer (ADR-0016: e-mail de conta avisa o usuário; notificação só loga).
 */
export async function sendEmail(to: string, email: Email): Promise<void> {
  transporter ??= createTransport();
  await transporter.sendMail({
    from: requireEnv("EMAIL_FROM"),
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
