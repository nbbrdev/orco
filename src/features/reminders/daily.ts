import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { anonymizeOldEventIps } from "@/features/public-quote/public-quote";
import { getAppDb } from "@/lib/db";
import { notifyFreelancer } from "@/lib/notify";

// As tarefas do agendamento diário (NBB-62, L2-A): o lembrete de vencimento (RN-43), a anonimização
// dos IPs com mais de 12 meses (RN-37) e a limpeza das janelas antigas dos limites de uso e das
// sessões expiradas (NBB-30 T4-A). Quem chama é a rota /api/cron/diario, protegida pela CRON_SECRET;
// não há sessão de ninguém, então os dados vêm das funções SECURITY DEFINER (L4-A).

// O JSON de app.claim_due_reminders (migration 0014).
const dueRemindersSchema = z.array(
  z.object({
    quoteId: z.uuid(),
    number: z.number().int().positive(),
    clientName: z.string().nullable(),
    validUntil: z.string(),
    accountEmail: z.string(),
    emailNotifications: z.boolean(),
    pushSubscriptions: z.array(
      z.object({ endpoint: z.string(), p256dh: z.string(), auth: z.string() }),
    ),
  }),
);

/**
 * Lembra os orçamentos que vencem amanhã e ainda não foram respondidos (RN-43). A função do banco já
 * marca cada um como lembrado, então rodar duas vezes não duplica. Devolve quantos foram lembrados.
 */
export async function sendDueReminders(): Promise<number> {
  const rows = await getAppDb().execute<{ due: unknown }>(
    sql`select app.claim_due_reminders() as due`,
  );
  const due = dueRemindersSchema.parse(rows[0]?.due ?? []);
  // Um de cada vez: são poucos por dia, e assim o SMTP não recebe uma rajada.
  for (const reminder of due) {
    await notifyFreelancer(
      {
        accountEmail: reminder.accountEmail,
        emailNotifications: reminder.emailNotifications,
        pushSubscriptions: reminder.pushSubscriptions,
      },
      {
        type: "quote_reminder",
        quoteId: reminder.quoteId,
        number: reminder.number,
        clientName: reminder.clientName,
        validUntil: reminder.validUntil,
      },
    );
  }
  return due.length;
}

// O JSON de app.purge_old_records (migration 0015).
const purgeSchema = z.object({ rateLimits: z.number().int(), sessions: z.number().int() });

/**
 * Apaga as janelas dos limites de uso com mais de 2 dias (as chaves têm IP) e as sessões de login
 * expiradas (com IP e navegador), como promete a política de privacidade. Devolve quantas saíram.
 */
export async function purgeOldRecords(): Promise<z.infer<typeof purgeSchema>> {
  const rows = await getAppDb().execute<{ purged: unknown }>(
    sql`select app.purge_old_records() as purged`,
  );
  return purgeSchema.parse(rows[0]?.purged);
}

export type DailyResult = {
  reminders: number;
  anonymizedIps: number;
  purgedRateLimits: number;
  purgedSessions: number;
};

/** As tarefas do dia. */
export async function runDailyTasks(): Promise<DailyResult> {
  const reminders = await sendDueReminders();
  const anonymizedIps = await anonymizeOldEventIps();
  const purged = await purgeOldRecords();
  return {
    reminders,
    anonymizedIps,
    purgedRateLimits: purged.rateLimits,
    purgedSessions: purged.sessions,
  };
}
