"use server";

import { updateProfileField } from "@/features/profile/profile";
import {
  profileFieldSchema,
  type ProfileField,
  type ProfileValues,
} from "@/features/profile/schemas";
import { requireSessionUser } from "@/lib/auth/session";

// Server Action do perfil (F-14): salva um campo por vez, quando a pessoa sai dele (D3). O usuário
// vem da sessão validada no servidor, nunca do navegador.

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
