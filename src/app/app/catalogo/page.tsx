import type { Metadata } from "next";

import { ComingSoon } from "@/features/app-shell/components/coming-soon";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Catálogo" };

// Página PROVISÓRIA (NBB-41, N1): o catálogo (F-16) chega na sua issue.
export default async function CatalogPage() {
  await requireSessionUser();
  return <ComingSoon title="Catálogo" />;
}
