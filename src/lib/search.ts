// Busca no navegador (clientes e catálogo, NBB-44 K4-A): compara sem diferenciar acentos nem
// maiúsculas, então "joao" encontra "João".

/** Minúsculas e sem acentos. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
