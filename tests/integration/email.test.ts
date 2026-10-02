import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { sendEmail } from "@/lib/email";
import { confirmationEmail } from "@/lib/email/templates/confirmation";

// Envio de verdade por SMTP para o Mailpit (local: compose.dev.yaml; CI: service container), lido de
// volta pela API do Mailpit (ADR-0016, NBB-80).

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const to = `teste-${randomUUID()}@example.com`;
const siteUrl = "http://localhost:3000";
const link = `${siteUrl}/api/auth/verify-email?token=abc`;

type MailpitSearch = { messages: { ID: string; Subject: string }[] };
type MailpitMessage = { HTML: string; Text: string; From: { Address: string; Name: string } };

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
  if (!response.ok) {
    throw new Error(`Mailpit ${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

const sentIds: string[] = [];

afterAll(async () => {
  if (sentIds.length > 0) {
    await fetch(`${MAILPIT_URL}/api/v1/messages`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ IDs: sentIds }),
    });
  }
});

describe("sendEmail (SMTP)", () => {
  it("entrega o e-mail com HTML, texto e o remetente do Orçô", async () => {
    await sendEmail(to, confirmationEmail({ siteUrl, url: link }));

    const search = await mailpit<MailpitSearch>(
      `/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    expect(search.messages).toHaveLength(1);
    const [found] = search.messages;
    sentIds.push(found?.ID ?? "");
    expect(found?.Subject).toBe("Confirme seu e-mail");

    const message = await mailpit<MailpitMessage>(`/message/${found?.ID}`);
    expect(message.From.Address).toBe("nao-responda@orco.nbbrdev.com");
    expect(message.From.Name).toBe("Orçô");
    expect(message.HTML).toContain(`href="${link}"`);
    expect(message.Text).toContain(link);
  });
});
