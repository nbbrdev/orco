import Link from "next/link";

import { LogoIcon } from "@/components/brand/logo-icon";

// Moldura das páginas de termos e privacidade (RF-34, NBB-30 T6): públicas, estáticas, fora do login
// e do Basic Auth do staging. Texto longo em colunas estreitas, para ler bem no celular.

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  /** "dd/mm/aaaa" da última mudança no texto. */
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <Link
        href="/"
        className="flex items-center gap-2 self-start"
        aria-label="Orçô, página inicial"
      >
        <LogoIcon className="size-8" />
        <span className="text-xl font-bold tracking-tight">Orçô</span>
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-balance">{title}</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {updatedAt}</p>
      </header>
      <div className="flex flex-col gap-8 leading-relaxed [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
      <LegalLinks />
    </main>
  );
}

/** "Termos de uso · Privacidade": no rodapé das telas públicas (NBB-30 T5). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Documentos legais" className={className ?? "text-sm text-muted-foreground"}>
      <Link href="/termos" className="underline-offset-4 hover:text-foreground hover:underline">
        Termos de uso
      </Link>
      {" · "}
      <Link
        href="/privacidade"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Privacidade
      </Link>
    </nav>
  );
}
