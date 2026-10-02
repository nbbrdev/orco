import "server-only";

import { headers } from "next/headers";

/**
 * IP de quem fez a requisição. Vem do `X-Forwarded-For` que o Nginx da VPS **substitui** pelo IP real
 * da conexão (deploy/nginx/orco.nbbrdev.com.conf): um valor inventado pelo cliente é descartado.
 * Sem o header (ex.: `npm run dev` sem Nginx), devolve "unknown".
 */
export function clientIpFrom(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headerList.get("x-real-ip")?.trim() || "unknown";
}

export async function getClientIp(): Promise<string> {
  return clientIpFrom(await headers());
}
