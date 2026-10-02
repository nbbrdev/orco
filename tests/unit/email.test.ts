import { describe, expect, it } from "vitest";

import { escapeHtml } from "@/lib/email/escape";
import { confirmationEmail } from "@/lib/email/templates/confirmation";
import { passwordChangedEmail } from "@/lib/email/templates/password-changed";
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
    // O & do link vira &amp; dentro do HTML (o navegador desfaz ao abrir).
    const escaped = url.replace("&", "&amp;");
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
