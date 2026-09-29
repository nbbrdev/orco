// Aplica as migrations pendentes com a role dona (orco_owner). ADR-0014.
// Local: `npm run db:migrate` (lê o .env.local). Na VPS: serviço `migrate` do compose (NBB-35).
import { existsSync } from "node:fs";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const url = process.env.DATABASE_URL_OWNER;
if (!url) {
  console.error("Defina DATABASE_URL_OWNER (veja .env.example).");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "db/migrations" });
  console.log("Migrations aplicadas.");
} finally {
  await client.end();
}
