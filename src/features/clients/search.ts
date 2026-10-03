// Busca de clientes no navegador (RF-11, NBB-44 K4-A): por nome, e-mail ou CPF/CNPJ, sem diferenciar
// acentos nem maiúsculas ("joao" encontra "João"). O documento também é encontrado com ou sem
// pontuação, porque é guardado só com letras e números.

type Searchable = { name: string; email: string | null; document: string | null };

/** Minúsculas e sem acentos. */
function simplify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Os clientes que casam com o termo digitado. Termo vazio devolve todos. */
export function searchClients<T extends Searchable>(list: T[], term: string): T[] {
  const query = simplify(term.trim());
  if (!query) {
    return list;
  }
  const documentQuery = query.replace(/[^0-9a-z]/g, "");
  return list.filter(
    (client) =>
      simplify(client.name).includes(query) ||
      (client.email?.includes(query) ?? false) ||
      (documentQuery !== "" && (client.document?.toLowerCase().includes(documentQuery) ?? false)),
  );
}
