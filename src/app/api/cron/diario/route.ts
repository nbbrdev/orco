import { runDailyTasks } from "@/features/reminders/daily";
import { safeEqual } from "@/lib/basic-auth";

// Agendamento diário (NBB-62, L1-A, L2-A): o cron da VPS chama esta rota todo dia às 9h de São Paulo,
// pela porta local do app, com `Authorization: Bearer <CRON_SECRET>`. Faz o lembrete de vencimento
// (RN-43) e a anonimização dos IPs antigos (RN-37). Casca fina sobre src/features/reminders/daily.ts.
// - Sem a CRON_SECRET configurada: 503 (fechada, nunca aberta por esquecimento).
// - Senha ausente ou errada: 401, com a comparação em tempo constante (docs/07 §10.1).
// - POST porque muda dados (marca os lembretes, apaga IPs).

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ error: "CRON_SECRET não configurada." }, 503);
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!safeEqual(authorization, `Bearer ${secret}`)) {
    return json({ error: "Não autorizado." }, 401);
  }
  try {
    return json(await runDailyTasks());
  } catch (error) {
    console.error("Falha nas tarefas diárias.", error);
    return json({ error: "Falha nas tarefas diárias." }, 500);
  }
}
