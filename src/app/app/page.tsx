import { redirect } from "next/navigation";

// /app sozinho leva à tela inicial do app (docs/11-mapa.md).
export default function AppPage() {
  redirect("/app/orcamentos");
}
