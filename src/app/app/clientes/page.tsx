import type { Metadata } from "next";

import { listClients } from "@/features/clients/clients";
import { ClientList } from "@/features/clients/components/client-list";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Clientes" };

// Clientes do freelancer (F-15, NBB-44). A lista de orçamentos de cada cliente (RF-13) e o atalho
// "Novo orçamento para este cliente" chegam com os orçamentos, na M4 (K1-A).
export default async function ClientsPage() {
  const user = await requireSessionUser();
  const clients = await listClients(user.id);

  return (
    <div className="mx-auto w-full max-w-xl">
      <ClientList initial={clients} />
    </div>
  );
}
