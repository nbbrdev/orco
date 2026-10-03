import { normalizeForSearch } from "@/lib/search";

// Busca no catálogo, no navegador (RF-14, NBB-45 I1-A): pelo nome, sem diferenciar acentos nem
// maiúsculas.

/** Os itens cujo nome casa com o termo digitado. Termo vazio devolve todos. */
export function searchCatalogItems<T extends { name: string }>(list: T[], term: string): T[] {
  const query = normalizeForSearch(term.trim());
  if (!query) {
    return list;
  }
  return list.filter((item) => normalizeForSearch(item.name).includes(query));
}
