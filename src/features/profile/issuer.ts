import type { ProfileValues } from "@/features/profile/schemas";
import { formatDocument } from "@/lib/document";

// Quem emite o orçamento, como o cliente vê (RN-04): usado na prévia do cabeçalho no perfil (NBB-42),
// no PDF do dono (NBB-50) e no link público (NBB-52), para todos mostrarem sempre o mesmo.

export type IssuerProfile = Pick<
  ProfileValues,
  "businessName" | "displayName" | "phone" | "contactEmail" | "website" | "instagram" | "document"
>;

export type IssuerHeader = {
  /** Nulo se o perfil não tem nome nem e-mail de contato: o cabeçalho sai só com o orçamento. */
  name: string | null;
  contacts: string[];
};

/**
 * Nome e contatos do cabeçalho. O nome segue a ordem da RN-04: nome comercial → nome de exibição →
 * e-mail de contato. O e-mail da conta (o login) nunca aparece (NBB-52 D3-B). Os contatos vêm na
 * ordem telefone, e-mail, site (sem o https://), Instagram e CPF/CNPJ, sem repetir o que já é o nome.
 */
export function issuerHeader(profile: IssuerProfile): IssuerHeader {
  const name = profile.businessName ?? profile.displayName ?? profile.contactEmail ?? null;
  const contacts = [
    profile.phone,
    profile.contactEmail === name ? null : profile.contactEmail,
    profile.website?.replace(/^https?:\/\//, ""),
    profile.instagram,
    profile.document ? formatDocument(profile.document) : null,
  ].filter((value): value is string => !!value);
  return { name, contacts };
}
