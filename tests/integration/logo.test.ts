import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET } from "@/app/api/p/logos/[file]/route";
import { removeLogo, uploadLogo } from "@/features/profile/logo";
import { LOGO_FILE_PATTERN, LOGO_MAX_BYTES } from "@/features/profile/logo-rules";
import { getProfile } from "@/features/profile/profile";
import { closeDb, getAuthDb } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getObject } from "@/lib/storage";

// Logo do freelancer (NBB-81) contra o Postgres e o RustFS reais: envio, troca, remoção, recusa de
// arquivo que não é imagem e a rota pública.

// PNG de 1×1 px: o menor arquivo de imagem válido para os testes.
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const emails: string[] = [];

async function createAccount(): Promise<string> {
  const email = `teste-${randomUUID()}@example.com`;
  emails.push(email);
  const [created] = await getAuthDb()
    .insert(user)
    .values({ name: "Teste", email })
    .returning({ id: user.id });
  return created?.id ?? "";
}

function routeGet(file: string) {
  return GET(new Request(`http://localhost:3000/api/p/logos/${file}`), {
    params: Promise.resolve({ file }),
  });
}

let userA = "";
let userB = "";

beforeAll(async () => {
  userA = await createAccount();
  userB = await createAccount();
});

afterAll(async () => {
  await removeLogo(userA);
  await removeLogo(userB);
  await getAuthDb().delete(user).where(inArray(user.email, emails));
  await closeDb();
});

describe("logo", () => {
  it("envia, guarda com nome aleatório e serve pela rota pública", async () => {
    const result = await uploadLogo(userA, PNG);
    expect(result.status).toBe("saved");
    const logoPath = result.status === "saved" ? (result.logoPath ?? "") : "";

    // L4: só um UUID, sem o id da conta.
    expect(logoPath).toMatch(LOGO_FILE_PATTERN);
    expect(logoPath).not.toContain(userA);
    expect((await getProfile(userA)).logoPath).toBe(logoPath);

    const response = await routeGet(logoPath);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("trocar apaga o arquivo anterior", async () => {
    const before = (await getProfile(userA)).logoPath ?? "";
    await uploadLogo(userA, PNG);
    const after = (await getProfile(userA)).logoPath ?? "";

    expect(after).not.toBe(before);
    expect(await getObject(before)).toBeNull();
    expect(await getObject(after)).not.toBeNull();
  });

  it("remover tira do perfil e apaga o arquivo", async () => {
    const id = await createAccount();
    await uploadLogo(id, PNG);
    const logoPath = (await getProfile(id)).logoPath ?? "";

    expect(await removeLogo(id)).toEqual({ status: "saved", logoPath: null });
    expect((await getProfile(id)).logoPath).toBeNull();
    expect(await getObject(logoPath)).toBeNull();
  });

  it("recusa o que não é imagem (pelos bytes) e arquivo grande demais", async () => {
    const fakePng = new TextEncoder().encode("<svg onload=alert(1)></svg>");
    expect((await uploadLogo(userB, fakePng)).status).toBe("invalid");

    const huge = new Uint8Array(LOGO_MAX_BYTES + 1);
    huge.set(PNG);
    expect((await uploadLogo(userB, huge)).status).toBe("invalid");

    expect((await getProfile(userB)).logoPath).toBeNull();
  });

  it("uma conta não mexe no logo de outra", async () => {
    const logoA = (await getProfile(userA)).logoPath ?? "";
    await removeLogo(userB);
    expect(await getObject(logoA)).not.toBeNull();
    expect((await getProfile(userA)).logoPath).toBe(logoA);
  });

  it("a rota responde 404 para nome inválido ou arquivo inexistente", async () => {
    expect((await routeGet("../segredo.png")).status).toBe(404);
    expect((await routeGet(`${randomUUID()}.svg`)).status).toBe(404);
    expect((await routeGet(`${randomUUID()}.png`)).status).toBe(404);
  });
});
