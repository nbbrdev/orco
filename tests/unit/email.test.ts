import { describe, expect, it } from "vitest";

import { escapeHtml } from "@/lib/email/escape";
import { accountDeletedEmail } from "@/lib/email/templates/account-deleted";
import { confirmationEmail } from "@/lib/email/templates/confirmation";
import { passwordChangedEmail } from "@/lib/email/templates/password-changed";
import { quoteReminderEmail, reminderTitle } from "@/lib/email/templates/quote-reminder";
import { quoteResponseEmail, responderName } from "@/lib/email/templates/quote-response";
import { recoveryEmail } from "@/lib/email/templates/recovery";

const siteUrl = "https://staging.orco.nbbrdev.com";

describe("escapeHtml", () => {
  it("transforma os caracteres especiais do HTML em texto", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });

  it("não altera texto comum", () => {
    expect(escapeHtml("maria.silva@example.com")).toBe("maria.silva@example.com");
  });
});

describe("confirmationEmail", () => {
  const url = `${siteUrl}/api/auth/verify-email?token=abc&callbackURL=/app`;
  const email = confirmationEmail({ siteUrl, url });

  it("tem assunto, botão e link de reserva com o mesmo endereço", () => {
    expect(email.subject).toBe("Confirme seu e-mail");
    // Os & do link viram &amp; dentro do HTML (o navegador desfaz ao abrir).
    const escaped = escapeHtml(url);
    expect(email.html.split(`href="${escaped}"`)).toHaveLength(3);
    expect(email.html).toContain("Confirmar e-mail");
    expect(email.html).toContain(`${siteUrl}/email/logo.png`);
  });

  it("tem a versão em texto com o link por extenso", () => {
    expect(email.text).toContain("Confirme seu e-mail");
    expect(email.text).toContain(url);
    expect(email.text).toContain("Esta caixa não recebe respostas.");
  });
});

describe("recoveryEmail", () => {
  it("leva o link de redefinição no botão e no texto", () => {
    const url = `${siteUrl}/api/auth/reset-password/tok123`;
    const email = recoveryEmail({ siteUrl, url });
    expect(email.subject).toBe("Redefina sua senha");
    expect(email.html).toContain(`href="${url}"`);
    expect(email.html).toContain("Criar nova senha");
    expect(email.text).toContain(url);
  });
});

describe("passwordChangedEmail", () => {
  it("mostra o e-mail da conta e o atalho para recuperar a senha", () => {
    const email = passwordChangedEmail({ siteUrl, email: "maria@example.com" });
    expect(email.subject).toBe("Sua senha foi alterada");
    expect(email.html).toContain("<strong>maria@example.com</strong>");
    expect(email.html).toContain(`href="${siteUrl}/recuperar-senha"`);
    expect(email.text).toContain(`${siteUrl}/recuperar-senha`);
  });

  it("escapa o e-mail antes de inserir no HTML", () => {
    const email = passwordChangedEmail({ siteUrl, email: `<img src=x onerror=alert(1)>@x.com` });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;@x.com");
  });
});

describe("accountDeletedEmail", () => {
  it("diz qual conta foi excluída e o que fazer se não foi a pessoa (NBB-82)", () => {
    const email = accountDeletedEmail({ siteUrl, email: "maria@example.com" });
    expect(email.subject).toBe("Sua conta no Orçô foi excluída");
    expect(email.html).toContain("<strong>maria@example.com</strong>");
    expect(email.html).toContain("Se não foi você");
    expect(email.text).toContain("maria@example.com");
    expect(email.text).toContain("Troque a senha do seu e-mail");
  });

  it("escapa o e-mail antes de inserir no HTML", () => {
    const email = accountDeletedEmail({ siteUrl, email: `<img src=x onerror=alert(1)>@x.com` });
    expect(email.html).not.toContain("<img src=x");
  });
});

describe("quoteResponseEmail (RN-40, NBB-55)", () => {
  const base = {
    siteUrl,
    quoteId: "7d3f6a4e-1f2b-4c5d-8e9f-0a1b2c3d4e5f",
    number: 12,
    respondentName: null,
    clientName: null,
    reasonCode: null,
    reason: null,
  } as const;
  const url = `${siteUrl}/app/orcamentos/${base.quoteId}`;

  it("aprovado: quem aprovou, o número e o botão para o orçamento", () => {
    const email = quoteResponseEmail({ ...base, decision: "approved", respondentName: "Maria" });
    expect(email.subject).toBe("Maria aprovou o orçamento Nº 0012");
    expect(email.html).toContain("Ver orçamento");
    expect(email.html.split(`href="${url}"`)).toHaveLength(3);
    expect(email.html).not.toContain("Motivo");
    // O título da moldura não se repete no corpo.
    expect(email.html).not.toContain(`${email.subject}.`);
    expect(email.text).not.toContain(`${email.subject}.`);
    expect(email.text).toContain(`Ver orçamento: ${url}`);
    expect(email.text).toContain("Para desligar, vá em Perfil.");
  });

  it("recusado: o motivo e o texto do cliente, com as quebras de linha", () => {
    const email = quoteResponseEmail({
      ...base,
      decision: "rejected",
      clientName: "João Souza",
      reasonCode: "price",
      reason: "Acima do previsto.\nObrigado!",
    });
    expect(email.subject).toBe("João Souza recusou o orçamento Nº 0012");
    expect(email.html).toContain("Motivo: <strong>Preço</strong>");
    expect(email.html).toContain("“Acima do previsto.<br>Obrigado!”");
    expect(email.text).toContain("Motivo: Preço");
  });

  it("escapa o que o cliente escreveu", () => {
    const email = quoteResponseEmail({
      ...base,
      decision: "rejected",
      clientName: "<b>x</b>",
      reason: `<img src=x onerror=alert(1)>`,
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<b>x</b>");
  });
});

describe("quoteReminderEmail (RN-43, NBB-62)", () => {
  const quoteId = "7d3f6a4e-1f2b-4c5d-8e9f-0a1b2c3d4e5f";

  it("o título com o cliente, a validade e o botão para o orçamento", () => {
    const email = quoteReminderEmail({
      siteUrl,
      quoteId,
      number: 12,
      clientName: "Maria Silva",
      validUntil: "2026-10-05",
    });
    expect(email.subject).toBe(
      "O orçamento Nº 0012 (Maria Silva) vence amanhã e ainda não foi respondido",
    );
    expect(email.html).toContain("Válido até 05/10/2026.");
    expect(email.html).toContain(`href="${siteUrl}/app/orcamentos/${quoteId}"`);
    expect(email.text).toContain("Para desligar, vá em Perfil.");
  });

  it("sem cliente, sem os parênteses; o nome é escapado no HTML", () => {
    expect(reminderTitle(1, null)).toBe(
      "O orçamento Nº 0001 vence amanhã e ainda não foi respondido",
    );
    const email = quoteReminderEmail({
      siteUrl,
      quoteId,
      number: 1,
      clientName: "<b>x</b>",
      validUntil: "2026-10-05",
    });
    expect(email.html).not.toContain("<b>x</b>");
  });
});

describe("responderName (RN-40)", () => {
  it("usa o nome informado, depois o cliente do orçamento, depois 'Seu cliente'", () => {
    expect(responderName("Maria", "João")).toBe("Maria");
    expect(responderName("  ", "João")).toBe("João");
    expect(responderName(null, null)).toBe("Seu cliente");
  });
});
