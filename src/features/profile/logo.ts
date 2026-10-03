import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { LOGO_MAX_BYTES } from "@/features/profile/logo-rules";
import { withUserDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { deleteObject, putObject } from "@/lib/storage";

// O "miolo" do logo (RN-05, NBB-81), sem nada do Next. O navegador já manda a imagem reduzida (L2);
// aqui o servidor confere o tipo pelos primeiros bytes do arquivo, e não pelo nome ou pelo
// Content-Type enviado (docs/07 §9), e guarda com um nome aleatório (L4).

type ImageType = { ext: "webp" | "png" | "jpg"; contentType: string };

/** O tipo real da imagem, pelos primeiros bytes ("assinatura" do formato), ou `null`. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ext: "png", contentType: "image/png" };
  }
  if (startsWith([0xff, 0xd8, 0xff])) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  // "RIFF" + 4 bytes de tamanho + "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

export type LogoResult =
  { status: "saved"; logoPath: string | null } | { status: "invalid"; message: string };

const INVALID_FILE = "Use uma imagem PNG, JPEG ou WebP de até 5 MB.";

/** Guarda o logo novo, aponta o perfil para ele e apaga o anterior. */
export async function uploadLogo(userId: string, bytes: Uint8Array): Promise<LogoResult> {
  if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) {
    return { status: "invalid", message: INVALID_FILE };
  }
  const type = detectImageType(bytes);
  if (!type) {
    return { status: "invalid", message: INVALID_FILE };
  }

  // L4: só um UUID gerado aqui, sem o id da conta: o endereço do logo é público (página do orçamento).
  const logoPath = `${randomUUID()}.${type.ext}`;
  await putObject(logoPath, bytes, type.contentType);
  const previous = await setLogoPath(userId, logoPath);
  await deleteQuietly(previous);
  return { status: "saved", logoPath };
}

/** Tira o logo do perfil e apaga o arquivo. */
export async function removeLogo(userId: string): Promise<LogoResult> {
  const previous = await setLogoPath(userId, null);
  await deleteQuietly(previous);
  return { status: "saved", logoPath: null };
}

/** Troca o `logo_path` do perfil e devolve o anterior, numa transação só. */
async function setLogoPath(userId: string, logoPath: string | null): Promise<string | null> {
  return withUserDb(userId, async (tx) => {
    const [current] = await tx
      .select({ logoPath: profiles.logoPath })
      .from(profiles)
      .where(eq(profiles.id, userId));
    await tx.update(profiles).set({ logoPath }).where(eq(profiles.id, userId));
    return current?.logoPath ?? null;
  });
}

/** O arquivo antigo some depois que o perfil já aponta para o novo; se falhar, só fica no log. */
async function deleteQuietly(logoPath: string | null): Promise<void> {
  if (!logoPath) return;
  try {
    await deleteObject(logoPath);
  } catch (error) {
    console.error("Falha ao apagar o logo antigo.", error);
  }
}
