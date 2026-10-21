import { createHash, timingSafeEqual } from "node:crypto";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

// Compara dois textos secretos (ex.: o `Authorization: Bearer` do agendamento diário, NBB-62) em tempo
// constante: o tempo de resposta não revela quantos caracteres estavam certos. O hash iguala o tamanho
// dos dois lados, exigência do `timingSafeEqual`.
// Nada é armazenado: o SHA-256 aqui não é "hash de senha" (esse papel é do Better Auth, ADR-0013). O
// alerta js/insufficient-password-hash do CodeQL foi fechado como falso positivo (NBB-35).
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}
