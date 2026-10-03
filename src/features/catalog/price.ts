import { formatBRL } from "@/lib/money";

// Exibição do preço do catálogo (NBB-45). Fica separado de schemas.ts para a tela não carregar o
// schema do banco no navegador.

/** Preço para o campo de texto, sem o "R$": 123456 → "1.234,56". */
export function priceToInput(cents: number | null): string {
  return cents === null ? "" : formatBRL(cents).replace(/^R\$\s*/u, "");
}

/** Preço e unidade como aparecem na lista (I6-A): "R$ 800,00 / h", "R$ 800,00" ou "Sem preço". */
export function describePrice(item: {
  unit: string | null;
  unitPriceCents: number | null;
}): string {
  if (item.unitPriceCents === null) return "Sem preço";
  const price = formatBRL(item.unitPriceCents);
  return item.unit ? `${price} / ${item.unit}` : price;
}
