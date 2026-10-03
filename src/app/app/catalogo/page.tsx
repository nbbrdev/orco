import type { Metadata } from "next";

import { listCatalogItems } from "@/features/catalog/catalog";
import { CatalogList } from "@/features/catalog/components/catalog-list";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Catálogo" };

// Catálogo de itens do freelancer (F-16, NBB-45). A pergunta "Atualizar também os N rascunhos?"
// (RN-11) chega com os orçamentos, na M4.
export default async function CatalogPage() {
  const user = await requireSessionUser();
  const items = await listCatalogItems(user.id);

  return (
    <div className="mx-auto w-full max-w-xl">
      <CatalogList initial={items} />
    </div>
  );
}
