// Conteúdo das páginas provisórias do app (NBB-41, N1): a navegação já leva a elas, e cada uma é
// substituída pela tela de verdade na sua issue.
export function ComingSoon({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">Em breve. Estamos construindo.</p>
      {children}
    </div>
  );
}
