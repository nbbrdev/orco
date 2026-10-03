// Regras do logo usadas no navegador e no servidor (RN-05, NBB-81).

/** Até 5 MB no arquivo original (RN-05). O Nginx e as Server Actions aceitam o mesmo (L3). */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** O navegador reduz a imagem até este lado maior antes de enviar (RN-05). */
export const LOGO_MAX_SIDE = 1024;

export const LOGO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Nome do arquivo no RustFS e no endereço público: `{uuid}.{webp|png|jpg}` (L4). */
export const LOGO_FILE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|png|jpg)$/;

/** Endereço público do logo (página do orçamento, PDF, prévia do perfil). */
export function logoUrl(logoPath: string): string {
  return `/api/p/logos/${logoPath}`;
}
