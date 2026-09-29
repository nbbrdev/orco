import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDb, getAppDb, getAuthDb, withUserDb } from "@/lib/db";

// Prova, contra um Postgres real, que a base de segurança funciona (ADR-0014, docs/07 §3).
// Usa uma tabela de prova com a MESMA receita de toda tabela do produto:
// ENABLE + FORCE ROW LEVEL SECURITY e policy `user_id = app.current_user_id()`.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Defina ${name} para os testes de integração (veja .env.example).`);
  }
  return value;
}

const owner = postgres(requireEnv("DATABASE_URL_OWNER"), { max: 1, onnotice: () => {} });

const userA = randomUUID();
const userB = randomUUID();

// O Drizzle embrulha o erro do Postgres ("Failed query: …"); a mensagem real fica em `cause`.
async function postgresErrorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return cause instanceof Error ? cause.message : String(cause);
  }
  return "(nenhum erro)";
}

async function countAs(userId: string): Promise<number> {
  return withUserDb(userId, async (tx) => {
    const rows = await tx.execute<{ n: number }>(sql`select count(*)::int as n from rls_probe`);
    return rows[0]?.n ?? -1;
  });
}

beforeAll(async () => {
  // Criada pela dona (orco_owner), como numa migration de verdade.
  await owner.unsafe(`
    drop table if exists public.rls_probe;
    create table public.rls_probe (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      note text not null
    );
    alter table public.rls_probe enable row level security;
    alter table public.rls_probe force row level security;
    create policy rls_probe_owner on public.rls_probe
      for all to app_user
      using (user_id = app.current_user_id())
      with check (user_id = app.current_user_id());
  `);
});

afterAll(async () => {
  await owner.unsafe("drop table if exists public.rls_probe");
  await owner.end();
  await closeDb();
});

describe("RLS com as roles do Orçô", () => {
  it("each user only sees their own rows", async () => {
    await withUserDb(userA, (tx) =>
      tx.execute(sql`insert into rls_probe (user_id, note) values (${userA}, 'do A')`),
    );

    expect(await countAs(userA)).toBe(1);
    expect(await countAs(userB)).toBe(0);
  });

  it("a user cannot change another user's rows", async () => {
    const updated = await withUserDb(userB, (tx) =>
      tx.execute(sql`update rls_probe set note = 'invadido' where user_id = ${userA}`),
    );
    expect(updated.count).toBe(0);

    const deleted = await withUserDb(userB, (tx) =>
      tx.execute(sql`delete from rls_probe where user_id = ${userA}`),
    );
    expect(deleted.count).toBe(0);

    const notes = await withUserDb(userA, (tx) =>
      tx.execute<{ note: string }>(sql`select note from rls_probe`),
    );
    expect(notes.map((row) => row.note)).toEqual(["do A"]);
  });

  it("a user cannot write rows in another user's name", async () => {
    const error = await postgresErrorOf(
      withUserDb(userB, (tx) =>
        tx.execute(sql`insert into rls_probe (user_id, note) values (${userA}, 'falso')`),
      ),
    );
    expect(error).toMatch(/row-level security/);
  });

  it("sees nothing outside withUserDb (no user in the transaction)", async () => {
    const rows = await getAppDb().execute<{ n: number }>(
      sql`select count(*)::int as n from rls_probe`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it("app_auth cannot read product tables", async () => {
    const error = await postgresErrorOf(getAuthDb().execute(sql`select * from public.rls_probe`));
    expect(error).toMatch(/permission denied/);
  });

  it("app_user cannot turn RLS off or change the table", async () => {
    expect(
      await postgresErrorOf(
        getAppDb().execute(sql`alter table rls_probe disable row level security`),
      ),
    ).toMatch(/must be owner/);
    expect(await postgresErrorOf(getAppDb().execute(sql`drop table rls_probe`))).toMatch(
      /must be owner/,
    );
  });

  it("withUserDb rejects anything that is not a UUID", async () => {
    await expect(withUserDb("1 or 1=1", async () => 0)).rejects.toThrow(/UUID/);
  });
});
