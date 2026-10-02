import { afterAll, describe, expect, it } from "vitest";

import { GET } from "@/app/api/auth/[...all]/route";
import { getAuth } from "@/lib/auth";
import { closeDb } from "@/lib/db";

// Login com Google (F-02, NBB-40 G7). O Google de verdade não é chamado: os testes conferem o link
// gerado para ele e a volta com erro. O login real é testado à mão no staging.

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

afterAll(closeDb);

/** Pede o link do Google como o botão faz e devolve o link e os cookies gravados (o `state`). */
async function startGoogleSignIn(): Promise<{ url: URL; cookie: string }> {
  const { headers, response } = await getAuth().api.signInSocial({
    body: { provider: "google", callbackURL: "/app/orcamentos", errorCallbackURL: "/entrar" },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { url: new URL(response.url ?? ""), cookie };
}

describe("Continuar com Google", () => {
  it("leva ao Google com o retorno em /api/auth/callback/google", async () => {
    const { url } = await startGoogleSignIn();

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(`${SITE_URL}/api/auth/callback/google`);
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining(["openid", "email", "profile"]),
    );
  });

  it("cancelar no Google volta para o /entrar com o código (G5)", async () => {
    const { url, cookie } = await startGoogleSignIn();
    const state = url.searchParams.get("state") ?? "";

    const response = await GET(
      new Request(
        `${SITE_URL}/api/auth/callback/google?error=access_denied&state=${encodeURIComponent(state)}`,
        { headers: { cookie } },
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/\/entrar\?error=access_denied/);
  });

  it("volta sem `state` válido também cai no /entrar, não na página do Better Auth", async () => {
    const response = await GET(
      new Request(`${SITE_URL}/api/auth/callback/google?code=qualquer&state=inventado`),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/\/entrar\?error=/);
  });
});
