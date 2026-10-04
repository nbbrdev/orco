import { describe, expect, it } from "vitest";

import { publicQuoteUrl, shareMessage, updateMessage } from "@/features/quotes/share";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// Compartilhar o orçamento (F-06, NBB-54).

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";

describe("publicQuoteUrl", () => {
  it("usa a origem da página, igual no staging e na produção", () => {
    expect(publicQuoteUrl("https://orco.nbbrdev.com", TOKEN)).toBe(
      `https://orco.nbbrdev.com/p/${TOKEN}`,
    );
    expect(publicQuoteUrl("https://staging.orco.nbbrdev.com", TOKEN)).toBe(
      `https://staging.orco.nbbrdev.com/p/${TOKEN}`,
    );
  });
});

describe("shareMessage", () => {
  it("escreve a mensagem do F-06 com o número formatado", () => {
    expect(shareMessage(1, "https://orco.nbbrdev.com/p/x")).toBe(
      "Olá! Segue o orçamento Nº 0001: https://orco.nbbrdev.com/p/x",
    );
  });

  it("escreve o aviso de alteração do F-10", () => {
    expect(updateMessage(1, "https://orco.nbbrdev.com/p/x")).toBe(
      "Olá! Atualizei o orçamento Nº 0001: https://orco.nbbrdev.com/p/x",
    );
  });

  it("vira um link do WhatsApp com a mensagem inteira codificada", () => {
    const url = `https://orco.nbbrdev.com/p/${TOKEN}`;
    const link = buildWhatsAppLink("(11) 91234-5678", shareMessage(12, url));
    expect(link.startsWith("https://wa.me/5511912345678?text=")).toBe(true);
    expect(new URL(link).searchParams.get("text")).toBe(`Olá! Segue o orçamento Nº 0012: ${url}`);
  });
});
