// Token inválido, rascunho ou orçamento excluído: a mesma página, sem dizer qual (RN-31). Sempre clara,
// como a página do orçamento.
export default function PublicQuoteNotFound() {
  return (
    <main className="light-scheme min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Orçamento não encontrado</h1>
        <p className="text-muted-foreground">
          Confira o link com quem enviou o orçamento. Ele pode ter sido trocado ou excluído.
        </p>
      </div>
    </main>
  );
}
