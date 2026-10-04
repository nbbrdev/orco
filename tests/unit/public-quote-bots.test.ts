import { describe, expect, it } from "vitest";

import { isPreviewBot } from "@/features/public-quote/bots";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// Robôs de pré-visualização (RN-35, NBB-53 P2-A) e o link do WhatsApp (F-07, P7-A).

describe("isPreviewBot", () => {
  it("reconhece as prévias dos apps de conversa, das redes e dos buscadores", () => {
    for (const agent of [
      "WhatsApp/2.23.20.0 A",
      "TelegramBot (like TwitterBot)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (Macintosh) AppleWebKit (KHTML, like Gecko) Applebot/0.1",
      "LinkedInBot/1.0",
      "Some-Crawler preview",
    ]) {
      expect(isPreviewBot(agent)).toBe(true);
    }
  });

  it("deixa passar os navegadores de verdade", () => {
    for (const agent of [
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    ]) {
      expect(isPreviewBot(agent)).toBe(false);
    }
  });

  it("sem user agent, trata como robô", () => {
    expect(isPreviewBot(null)).toBe(true);
    expect(isPreviewBot("")).toBe(true);
  });
});

describe("buildWhatsAppLink", () => {
  const message = "Olá! Acabei de aprovar o orçamento Nº 0001.";
  const encoded = encodeURIComponent(message);

  it("telefone brasileiro com DDD ganha o 55", () => {
    expect(buildWhatsAppLink("(11) 91234-5678", message)).toBe(
      `https://wa.me/5511912345678?text=${encoded}`,
    );
    expect(buildWhatsAppLink("(11) 1234-5678", message)).toBe(
      `https://wa.me/551112345678?text=${encoded}`,
    );
  });

  it("número já com o código do país fica como está", () => {
    expect(buildWhatsAppLink("+55 11 91234-5678", message)).toBe(
      `https://wa.me/5511912345678?text=${encoded}`,
    );
  });

  it("sem telefone (ou com um curto demais), a pessoa escolhe o contato", () => {
    expect(buildWhatsAppLink(null, message)).toBe(`https://wa.me/?text=${encoded}`);
    expect(buildWhatsAppLink("1234", message)).toBe(`https://wa.me/?text=${encoded}`);
  });
});
