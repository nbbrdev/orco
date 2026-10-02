import { CircleUser, FileText, type LucideIcon, Package, Users } from "lucide-react";

// Navegação principal do app logado (docs/11-mapa.md, NBB-41 N2/N5). Uma lista só, usada pela barra
// inferior (celular) e pela barra do topo (tablet e computador).

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/app/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/app/catalogo", label: "Catálogo", icon: Package },
  { href: "/app/perfil", label: "Perfil", icon: CircleUser },
];

export const NEW_QUOTE_HREF = "/app/orcamentos/novo";

/** Item da página atual: a própria rota ou uma rota "filha" (ex.: /app/orcamentos/123). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
