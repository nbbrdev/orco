/** Endereço público do ambiente, sem barra no fim (`SITE_URL`, docs/06-regras-dev.md §8). */
export function siteUrl(): string {
  const value = process.env.SITE_URL;
  if (!value) throw new Error("Defina SITE_URL (veja .env.example).");
  return value.replace(/\/+$/, "");
}
