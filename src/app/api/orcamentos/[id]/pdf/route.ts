import { PDF_LIMIT_MESSAGE, renderOwnerPdf } from "@/features/quotes/pdf";
import { getSessionUser } from "@/lib/auth/session";

// PDF do orçamento para o dono (F-06, NBB-51). Casca fina sobre src/features/quotes/pdf.ts.
// - GET: a prévia (RN-22a), aberta numa aba nova pelo "Visualizar"; não muda o status (P5-A).
// O usuário vem da sessão validada no servidor; orçamento de outra conta é 404 (RLS).

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/api/orcamentos/[id]/pdf">) {
  const user = await getSessionUser();
  if (!user) {
    return text("Entre na sua conta para ver o PDF.", 401);
  }
  const { id } = await params;
  const result = await renderOwnerPdf(user, id);
  if (result.status === "limit") {
    return text(PDF_LIMIT_MESSAGE, 429);
  }
  if (result.status === "not_found") {
    return text("Orçamento não encontrado.", 404);
  }
  return new Response(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline`: o navegador mostra, sem baixar. O nome vale para quem salvar pela prévia.
      "Content-Disposition": `inline; filename="${result.fileName}"`,
      // Dados do orçamento: nunca guardados em cache compartilhado.
      "Cache-Control": "private, no-store",
    },
  });
}
