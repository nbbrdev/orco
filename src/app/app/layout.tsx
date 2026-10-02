import { AppBottomBar, AppTopBar } from "@/features/app-shell/components/app-nav";

// Layout do app logado (NBB-41): só a moldura e a navegação. A checagem de login NÃO fica aqui: o
// layout não roda de novo ao navegar entre páginas, então cada página e Server Action chama o
// requireSessionUser() (P5).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <AppTopBar />
      {/* No celular, o espaço de baixo evita que a barra fixa e o botão flutuante cubram o conteúdo. */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-8 pb-40 md:pb-12">
        {children}
      </main>
      <AppBottomBar />
    </>
  );
}
