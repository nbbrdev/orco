import type { Metadata } from "next";

import { ComingSoon } from "@/features/app-shell/components/coming-soon";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Novo orçamento" };

// Página PROVISÓRIA (NBB-41, N1): o editor de orçamento chega na M4.
export default async function NewQuotePage() {
  await requireSessionUser();
  return <ComingSoon title="Novo orçamento" />;
}
