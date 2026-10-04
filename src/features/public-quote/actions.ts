"use server";

import { headers } from "next/headers";

import { type RespondResult, respondToQuote } from "@/features/public-quote/public-quote";
import { clientIpFrom } from "@/lib/request";

// Aprovar ou recusar pela página pública (F-07, F-08, NBB-53). Casca fina sobre public-quote.ts: o
// cliente não tem conta; quem limita é o token, a versão (R2-A) e o limite por IP (RN-39). IP e
// navegador vêm dos headers que o Nginx repassa (RN-34).

export async function respondAction(
  token: string,
  input: unknown,
): Promise<RespondResult | "error"> {
  const headerList = await headers();
  try {
    return await respondToQuote(
      token,
      input,
      clientIpFrom(headerList),
      headerList.get("user-agent"),
    );
  } catch (error) {
    console.error("Falha ao registrar a resposta do cliente.", error);
    return "error";
  }
}
