import type { ProfileValues } from "@/features/profile/schemas";
import { formatDocument } from "@/lib/document";

// Quem emite o orçamento, como o cliente vê (RN-04): usado na prévia do cabeçalho no perfil (NBB-42)
// e no PDF (NBB-50), para os dois mostrarem sempre o mesmo.

export type IssuerProfile = Pick<
  ProfileValues,
  "businessName" | "displayName" | "phone" | "contactEmail" | "website" | "instagram" | "document"
>;

/** Nome exibido pela ordem da RN-04: nome comercial → nome de exibição → e-mail da conta. */
export function issuerName(profile: IssuerProfile, accountEmail: string): string {
  return profile.businessName ?? profile.displayName ?? accountEmail;
}

/** Contatos preenchidos, na ordem do cabeçalho: telefone, e-mail, site (sem o https://), Instagram e CPF/CNPJ. */
export function issuerContacts(profile: IssuerProfile): string[] {
  return [
    profile.phone,
    profile.contactEmail,
    profile.website?.replace(/^https?:\/\//, ""),
    profile.instagram,
    profile.document ? formatDocument(profile.document) : null,
  ].filter((value): value is string => !!value);
}
