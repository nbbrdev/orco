import { renderPublicPdf } from "@/features/public-quote/public-quote";
import { PDF_LIMIT_MESSAGE } from "@/features/quotes/pdf";
import { getClientIp } from "@/lib/request";

// PDF do orçamento pelo link público (F-07 "Baixar PDF", NBB-52 D7). Casca fina sobre
// src/features/public-quote/public-quote.ts. Sem login: quem tem o token baixa. Fica sob /api/p/,
// liberado do Basic Auth no staging, como a página pública. Não conta visualização (D2-A).

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(_request: Request, { params }: RouteContext<"/api/p/[token]/pdf">) {
  const { token } = await params;
  const result = await renderPublicPdf(token, await getClientIp());
  if (result.status === "limit") {
    return text(PDF_LIMIT_MESSAGE, 429);
  }
  if (result.status === "not_found") {
    // A mesma resposta para rascunho, excluído e token inválido (RN-31).
    return text("Orçamento não encontrado.", 404);
  }
  return new Response(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "private, no-store",
      // O token não vaza para outros sites nem é indexado (docs/07-seguranca.md §4).
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
