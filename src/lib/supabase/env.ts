// Variáveis públicas do Supabase. O Next só embute `NEXT_PUBLIC_*` no bundle do navegador
// quando lidas por acesso direto (`process.env.NOME`), por isso não há leitura dinâmica aqui.
export function getSupabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.example).",
    );
  }

  return { url, publishableKey };
}
