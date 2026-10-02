import Link from "next/link";

import { LogoIcon } from "@/components/brand/logo-icon";

// Moldura das telas de conta (/cadastro, /entrar): logo, título e o conteúdo, centralizados e
// pensados primeiro para o celular.
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12">
      <Link
        href="/"
        className="flex items-center gap-2 self-start"
        aria-label="Orçô, página inicial"
      >
        <LogoIcon className="size-9" />
        <span className="text-2xl font-bold tracking-tight">Orçô</span>
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </main>
  );
}
