import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

// Invariantes de segurança do banco (docs/07, NBB-57 S1-A): conferidos contra o Postgres real a cada
// rodada do CI. Uma migration nova que esqueça a RLS, crie uma função SECURITY DEFINER sem
// `search_path` ou dê ao app uma permissão a mais faz este teste falhar, e a mudança precisa vir
// junto com a atualização daqui (e ser revisada no PR).

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} para os testes de integração (veja .env.example).`);
  return value;
}

const owner = postgres(requireEnv("DATABASE_URL_OWNER"), { max: 1, onnotice: () => {} });

afterAll(async () => {
  await owner.end();
});

/** O que a app_user pode fazer em cada tabela (permissões da tabela inteira). */
const APP_USER_TABLES: Record<string, string[]> = {
  "public.catalog_items": ["DELETE", "INSERT", "SELECT"],
  "public.clients": ["DELETE", "INSERT", "SELECT"],
  "public.profiles": ["SELECT"],
  "public.push_subscriptions": ["DELETE", "SELECT"],
  "public.quote_items": ["DELETE", "INSERT", "SELECT"],
  "public.quotes": ["DELETE", "INSERT", "SELECT"],
};

/** As colunas que a app_user pode alterar: nunca ids, donos, datas, contadores, versão ou token. */
const APP_USER_UPDATE_COLUMNS: Record<string, string[]> = {
  catalog_items: ["name", "unit", "unit_price_cents"],
  clients: ["address", "document", "email", "internal_notes", "name", "phone"],
  profiles: [
    "business_name",
    "contact_email",
    "default_delivery_time",
    "default_notes",
    "default_payment_terms",
    "default_validity_days",
    "display_name",
    "document",
    "email_notifications",
    "instagram",
    "logo_path",
    "payment_info",
    "phone",
    "push_prompted_at",
    "website",
  ],
  quote_items: [
    "catalog_item_id",
    "description",
    "discount_cents",
    "discount_type",
    "discount_value",
    "gross_cents",
    "line_total_cents",
    "position",
    "quantity",
    "unit",
    "unit_price_cents",
  ],
  quotes: [
    "client_address",
    "client_document",
    "client_email",
    "client_id",
    "client_name",
    "client_phone",
    "delivery_time",
    "discount_cents",
    "discount_type",
    "discount_value",
    "internal_notes",
    "notes",
    "payment_terms",
    "response_seen_at",
    "status",
    "subtotal_cents",
    "total_cents",
    "valid_until",
  ],
};

/** As funções do schema `app` que a app_user executa. */
const APP_USER_FUNCTIONS = [
  "anonymize_old_event_ips",
  "check_rate_limit",
  "claim_due_reminders",
  "current_user_id",
  "delete_push_subscription",
  "generate_public_token",
  "get_public_quote",
  "normalize_search",
  "regenerate_public_token",
  "register_quote_view",
  "respond_to_quote",
  "save_push_subscription",
];

describe("RLS (docs/07 §3)", () => {
  it("toda tabela do produto tem RLS ligada e forçada, com ao menos uma policy", async () => {
    const tables = await owner<
      { name: string; enabled: boolean; forced: boolean; policies: number }[]
    >`
      select c.relname as name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced,
             (select count(*)::int from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname) as policies
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by 1`;
    expect(tables.length).toBeGreaterThanOrEqual(8);
    for (const table of tables) {
      expect(table, table.name).toMatchObject({ enabled: true, forced: true });
      expect(table.policies, table.name).toBeGreaterThan(0);
    }
  });
});

describe('funções (docs/05 "Funções")', () => {
  it("todas as do schema `app` são da orco_owner e fixam o search_path vazio", async () => {
    const functions = await owner<{ name: string; owner: string; config: string[] | null }[]>`
      select p.proname as name, pg_get_userbyid(p.proowner) as owner, p.proconfig as config
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app'`;
    for (const fn of functions) {
      expect(fn.owner, fn.name).toBe("orco_owner");
      expect(fn.config ?? [], fn.name).toContain('search_path=""');
    }
  });

  it("nenhuma função dos schemas do app pode ser executada por PUBLIC", async () => {
    const open = await owner<{ name: string }[]>`
      select n.nspname || '.' || p.proname as name
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('app', 'public', 'auth')
         and exists (
           select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
            where a.grantee = 0 and a.privilege_type = 'EXECUTE'
         )`;
    expect(open.map((row) => row.name)).toEqual([]);
  });

  it("a app_user executa exatamente as funções esperadas", async () => {
    const rows = await owner<{ name: string }[]>`
      select p.proname as name
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and has_function_privilege('app_user', p.oid, 'EXECUTE')
       order by 1`;
    expect(rows.map((row) => row.name)).toEqual(APP_USER_FUNCTIONS);
  });
});

describe("permissões das roles do app (docs/07 §3, ADR-0014)", () => {
  it("nenhuma role do app é superusuária, ignora a RLS ou cria roles e bancos", async () => {
    const roles = await owner<Record<string, boolean | string>[]>`
      select rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
        from pg_roles where rolname in ('app_user', 'app_auth') order by 1`;
    expect(roles).toEqual([
      {
        rolname: "app_auth",
        rolsuper: false,
        rolbypassrls: false,
        rolcreaterole: false,
        rolcreatedb: false,
      },
      {
        rolname: "app_user",
        rolsuper: false,
        rolbypassrls: false,
        rolcreaterole: false,
        rolcreatedb: false,
      },
    ]);
  });

  it("as roles do app não criam nada em nenhum schema", async () => {
    const rows = await owner<{ schema: string; appUser: boolean; appAuth: boolean }[]>`
      select nspname as schema,
             has_schema_privilege('app_user', oid, 'CREATE') as "appUser",
             has_schema_privilege('app_auth', oid, 'CREATE') as "appAuth"
        from pg_namespace where nspname in ('public', 'app', 'auth', 'extensions')`;
    for (const row of rows) {
      expect(row, row.schema).toMatchObject({ appUser: false, appAuth: false });
    }
  });

  it("a app_user tem nas tabelas exatamente as permissões esperadas, e nada no schema auth", async () => {
    const rows = await owner<{ name: string; privileges: string[] }[]>`
      select table_schema || '.' || table_name as name,
             array_agg(privilege_type::text order by privilege_type) as privileges
        from information_schema.role_table_grants
       where grantee = 'app_user'
       group by table_schema, table_name
       order by 1`;
    expect(Object.fromEntries(rows.map((row) => [row.name, row.privileges]))).toEqual(
      APP_USER_TABLES,
    );
  });

  it("a app_user só altera as colunas que a pessoa edita", async () => {
    const rows = await owner<{ table: string; columns: string[] }[]>`
      select table_name as table, array_agg(column_name::text order by column_name) as columns
        from information_schema.column_privileges
       where grantee = 'app_user' and table_schema = 'public' and privilege_type = 'UPDATE'
       group by table_name
       order by 1`;
    expect(Object.fromEntries(rows.map((row) => [row.table, row.columns]))).toEqual(
      APP_USER_UPDATE_COLUMNS,
    );
  });

  it("a app_user não lê o IP dos eventos do link público (D8-A)", async () => {
    const [row] = await owner<{ canRead: boolean }[]>`
      select has_column_privilege('app_user', 'public.quote_events', 'ip', 'SELECT') as "canRead"`;
    expect(row?.canRead).toBe(false);
  });

  it("a app_auth só alcança as tabelas de login (schema auth)", async () => {
    const rows = await owner<{ schema: string }[]>`
      select distinct table_schema as schema
        from information_schema.role_table_grants where grantee = 'app_auth'`;
    expect(rows.map((row) => row.schema)).toEqual(["auth"]);
  });
});
