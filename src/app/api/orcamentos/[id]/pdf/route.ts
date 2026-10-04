import { NOT_READY_TO_SEND_MESSAGE } from "@/features/quotes/items";
import { PDF_LIMIT_MESSAGE, renderOwnerPdf } from "@/features/quotes/pdf";
import { getSessionUser } from "@/lib/auth/session";

// PDF do orçamento para o dono (F-06, NBB-51). Casca fina sobre src/features/quotes/pdf.ts.
// - GET: a prévia (RN-22a), aberta numa aba nova pelo "Visualizar"; não muda o status (P5-A).
// - POST: o download pelo "Baixar PDF" (RN-22), que envia o rascunho. É POST porque muda o status:
//   um GET poderia ser disparado por pré-carregamento ou por um link de outro site.
// O usuário vem da sessão validada no servidor; orçamento de outra conta é 404 (RLS).

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function respond(id: string, send: boolean): Promise<Response> {
  const user = await getSessionUser();
  if (!user) {
    return text("Entre na sua conta para ver o PDF.", 401);
  }
  const result = await renderOwnerPdf(user, id, { send });
  switch (result.status) {
    case "limit":
      return text(PDF_LIMIT_MESSAGE, 429);
    case "not_found":
      return text("Orçamento não encontrado.", 404);
    case "incomplete":
      return text(NOT_READY_TO_SEND_MESSAGE, 422);
    case "ok":
      return new Response(Buffer.from(result.bytes), {
        headers: {
          "Content-Type": "application/pdf",
          // `inline`: o navegador mostra; `attachment`: baixa com o nome do arquivo (P6).
          "Content-Disposition": `${send ? "attachment" : "inline"}; filename="${result.fileName}"`,
          // Dados do orçamento: nunca guardados em cache compartilhado.
          "Cache-Control": "private, no-store",
        },
      });
  }
}

export async function GET(_request: Request, { params }: RouteContext<"/api/orcamentos/[id]/pdf">) {
  return respond((await params).id, false);
}

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/orcamentos/[id]/pdf">,
) {
  return respond((await params).id, true);
}
