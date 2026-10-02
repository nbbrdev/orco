import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

// Porta do Better Auth (/api/auth/*): cadastro, login, logout, confirmação de e-mail, Google.
// O handler é montado na primeira requisição (getAuth), não no build.
export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
