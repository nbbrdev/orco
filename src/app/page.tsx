import { LogoIcon } from "@/components/brand/logo-icon";

// Versão no ar: tag vX.Y.Z em produção, staging-<commit> no staging, "dev" localmente (ADR-0010).
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { conta } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      {conta === "excluida" ? (
        // F-17 (NBB-43 E3): depois de excluir a conta.
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm">
          Sua conta foi excluída. Todos os seus dados foram apagados.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <LogoIcon className="size-12" />
        <span className="text-3xl font-bold tracking-tight">Orçô</span>
      </div>
      <h1 className="text-2xl font-semibold text-balance">Orçamentos simples para freelancers.</h1>
      <p className="text-muted-foreground">
        Crie um orçamento em menos de 2 minutos, envie por link ou PDF e receba a aprovação do
        cliente com um toque. Estamos construindo, e em breve você poderá usar.
      </p>
      <p className="text-xs text-muted-foreground">{APP_VERSION}</p>
    </main>
  );
}
