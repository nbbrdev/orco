"use server";

import { type LogoResult, removeLogo, uploadLogo } from "@/features/profile/logo";
import { logoUrl } from "@/features/profile/logo-rules";
import { updateProfileField } from "@/features/profile/profile";
import {
  profileFieldSchema,
  type ProfileField,
  type ProfileValues,
} from "@/features/profile/schemas";
import { requireSessionUser } from "@/lib/auth/session";

// Server Actions do perfil (F-14): salvam um campo por vez, quando a pessoa sai dele (D3), e o logo
// (NBB-81). O usuário vem da sessão validada no servidor, nunca do navegador.

export type SaveFieldState =
  { status: "saved"; value: ProfileValues[ProfileField] } | { status: "error"; message: string };

export async function saveProfileFieldAction(
  field: unknown,
  value: unknown,
): Promise<SaveFieldState> {
  const user = await requireSessionUser();
  const parsedField = profileFieldSchema.safeParse(field);
  if (!parsedField.success) {
    return { status: "error", message: "Campo desconhecido." };
  }
  try {
    const result = await updateProfileField(user.id, parsedField.data, value);
    return result.status === "saved" ? result : { status: "error", message: result.message };
  } catch (error) {
    console.error("Falha ao salvar o perfil.", error);
    return { status: "error", message: "Não foi possível salvar. Tente de novo." };
  }
}

export type LogoState =
  { status: "saved"; logoUrl: string | null } | { status: "error"; message: string };

function toLogoState(result: LogoResult): LogoState {
  return result.status === "saved"
    ? { status: "saved", logoUrl: result.logoPath ? logoUrl(result.logoPath) : null }
    : { status: "error", message: result.message };
}

/** Envia ou troca o logo (RN-05, NBB-81). O arquivo vem no campo `logo` do FormData. */
export async function uploadLogoAction(formData: FormData): Promise<LogoState> {
  const user = await requireSessionUser();
  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return { status: "error", message: "Escolha uma imagem." };
  }
  try {
    return toLogoState(await uploadLogo(user.id, new Uint8Array(await file.arrayBuffer())));
  } catch (error) {
    console.error("Falha ao enviar o logo.", error);
    return { status: "error", message: "Não foi possível enviar o logo. Tente de novo." };
  }
}

/** Remove o logo do perfil. */
export async function removeLogoAction(): Promise<LogoState> {
  const user = await requireSessionUser();
  try {
    return toLogoState(await removeLogo(user.id));
  } catch (error) {
    console.error("Falha ao remover o logo.", error);
    return { status: "error", message: "Não foi possível remover o logo. Tente de novo." };
  }
}
