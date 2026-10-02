import type { Metadata } from "next";

import { ComingSoon } from "@/features/app-shell/components/coming-soon";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Clientes" };

// Página PROVISÓRIA (NBB-41, N1): a lista de clientes (F-15) chega na sua issue.
export default async function ClientsPage() {
  await requireSessionUser();
  return <ComingSoon title="Clientes" />;
}
