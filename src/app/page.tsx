import { LogoIcon } from "@/components/brand/logo-icon";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="flex items-center gap-3">
        <LogoIcon className="size-12" />
        <span className="text-3xl font-bold tracking-tight">Orçô</span>
      </div>
      <h1 className="text-2xl font-semibold text-balance">Orçamentos simples para freelancers.</h1>
      <p className="text-muted-foreground">
        Crie um orçamento em menos de 2 minutos, envie por link ou PDF e receba a aprovação do
        cliente com um toque. Estamos construindo, e em breve você poderá usar.
      </p>
    </main>
  );
}
