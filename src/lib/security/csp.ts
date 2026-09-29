import { randomBytes } from "node:crypto";

import type { AppEnv } from "@/lib/app-env";

// Content Security Policy com nonce (docs/07-seguranca.md §7). Montada a cada requisição no proxy:
// o navegador só executa scripts que trazem o nonce daquela resposta.

// Cloudflare Turnstile (CAPTCHA do cadastro): script e iframe.
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Valor aleatório e imprevisível, novo a cada requisição (128 bits). */
export function createNonce(): string {
  return randomBytes(16).toString("base64");
}

export function buildCsp({ nonce, appEnv }: { nonce: string; appEnv: AppEnv }): string {
  const isDev = appEnv === "development";

  const directives: string[] = [
    "default-src 'self'",
    // 'strict-dynamic': scripts com o nonce podem carregar outros scripts (chunks do Next).
    // 'unsafe-eval' só em desenvolvimento: o React usa eval para detalhar erros.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${isDev ? " 'unsafe-eval'" : ""}`,
    // Atributos style="" (React, Radix) não aceitam nonce; CSS injetado não executa código.
    "style-src 'self' 'unsafe-inline'",
    // Logos vêm de uma rota do próprio app (RustFS atrás do servidor, ADR-0015).
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // O navegador só fala com o próprio app; banco e arquivos nunca são acessados direto.
    "connect-src 'self'",
    `frame-src ${TURNSTILE_ORIGIN}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Em http://localhost (e no celular pela rede local) não há HTTPS: trocar http por https quebraria.
  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}
