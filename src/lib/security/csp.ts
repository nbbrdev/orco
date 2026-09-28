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

export function buildCsp({
  nonce,
  appEnv,
  supabaseUrl,
}: {
  nonce: string;
  appEnv: AppEnv;
  supabaseUrl: string;
}): string {
  const isDev = appEnv === "development";
  const supabase = new URL(supabaseUrl).origin;

  const directives: string[] = [
    "default-src 'self'",
    // 'strict-dynamic': scripts com o nonce podem carregar outros scripts (chunks do Next).
    // 'unsafe-eval' só em desenvolvimento: o React usa eval para detalhar erros.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${isDev ? " 'unsafe-eval'" : ""}`,
    // Atributos style="" (React, Radix) não aceitam nonce; CSS injetado não executa código.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase}`,
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
