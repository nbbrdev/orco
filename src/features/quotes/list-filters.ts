// Abas e busca da lista de orçamentos (F-09, NBB-48 L1-A, L3-A). Ficam na URL, em pt-BR
// (`/app/orcamentos?status=enviados&busca=maria`), para o "voltar" do navegador manter o filtro.
// Funções puras, usadas na página (servidor) e nos componentes (navegador).

export type QuoteTab = "todos" | "rascunhos" | "enviados" | "aprovados" | "recusados" | "expirados";

export const QUOTE_TABS: { tab: QuoteTab; label: string; empty: string }[] = [
  { tab: "todos", label: "Todos", empty: "Nenhum orçamento." },
  { tab: "rascunhos", label: "Rascunhos", empty: "Nenhum rascunho." },
  { tab: "enviados", label: "Enviados", empty: "Nenhum orçamento enviado." },
  { tab: "aprovados", label: "Aprovados", empty: "Nenhum orçamento aprovado." },
  { tab: "recusados", label: "Recusados", empty: "Nenhum orçamento recusado." },
  { tab: "expirados", label: "Expirados", empty: "Nenhum orçamento expirado." },
];

/** Tamanho da busca guardada na URL; o resto é cortado. */
export const MAX_SEARCH_LENGTH = 100;

/** Orçamentos por vez na lista; "Mostrar mais" traz os próximos (L1-A). */
export const QUOTES_PAGE_SIZE = 50;

export type QuoteListFilters = { tab: QuoteTab; search: string };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Lê a aba e a busca da URL. Aba desconhecida vira "todos". */
export function parseListFilters(params: {
  status?: string | string[];
  busca?: string | string[];
}): QuoteListFilters {
  const status = first(params.status);
  const tab = QUOTE_TABS.find((entry) => entry.tab === status)?.tab ?? "todos";
  return { tab, search: first(params.busca).trim().slice(0, MAX_SEARCH_LENGTH) };
}

/** O endereço da lista com estes filtros; "todos" e busca vazia não aparecem na URL. */
export function listHref({ tab, search }: QuoteListFilters): string {
  const params = new URLSearchParams();
  if (tab !== "todos") params.set("status", tab);
  if (search) params.set("busca", search);
  const query = params.toString();
  return query ? `/app/orcamentos?${query}` : "/app/orcamentos";
}

/**
 * Como buscar (L5-A): só dígitos busca o número exato ("12" encontra o Nº 0012); qualquer outro texto
 * busca no nome do cliente.
 */
export function searchTarget(
  search: string,
): { by: "none" } | { by: "number"; number: number } | { by: "name"; text: string } {
  if (!search) return { by: "none" };
  if (/^\d+$/.test(search)) {
    const number = Number(search);
    // Número maior que o `integer` do banco: não existe, então busca algo que nunca casa.
    return { by: "number", number: number <= 2_147_483_647 ? number : 0 };
  }
  return { by: "name", text: search };
}
