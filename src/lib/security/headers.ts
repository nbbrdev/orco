// Headers de segurança fixos (iguais em toda resposta), aplicados pelo next.config.ts.
// A CSP muda a cada requisição (nonce) e por isso fica no proxy (src/lib/security/csp.ts).
// Regras em docs/07-seguranca.md §7.

type HeaderEntry = { key: string; value: string };
type HeaderRule = { source: string; headers: HeaderEntry[] };

const GLOBAL_HEADERS: HeaderEntry[] = [
  // Só HTTPS por 2 anos, inclusive subdomínios. Navegadores ignoram em http (localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Nenhum site pode exibir o Orçô num iframe (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // O navegador usa o tipo declarado, sem "adivinhar" (evita arquivo virar script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Para outros sites, só a origem (sem caminho) e só em HTTPS.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Recursos que o Orçô nunca usa ficam desligados para qualquer script.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Uma página de outro site aberta a partir do Orçô (ou que o abriu) não alcança esta janela
  // (NBB-57 S2). O login com o Google é por redirecionamento, não por pop-up, então não é afetado.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Página pública do orçamento: o token na URL nunca vaza por Referer nem é indexado (ADR-0005).
const PUBLIC_QUOTE_HEADERS: HeaderEntry[] = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// Ordem importa: a regra de /p/* vem depois e sobrescreve o Referrer-Policy global.
export const securityHeaders: HeaderRule[] = [
  { source: "/:path*", headers: GLOBAL_HEADERS },
  { source: "/p/:path*", headers: PUBLIC_QUOTE_HEADERS },
];
