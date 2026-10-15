/**
 * Ao abrir um painel (Sheet do Radix) para editar algo já salvo: o foco vai para o próprio painel, e
 * não para o primeiro campo. No celular, foco num campo abre o teclado e cobre o que a pessoa queria
 * ver (NBB-120 F1-A). O foco continua dentro do painel, para o teclado e os leitores de tela. Na
 * criação, o padrão do Radix (foco no primeiro campo) continua, porque ali a pessoa vai digitar.
 * Uso: `<SheetContent onOpenAutoFocus={editing ? focusPanelInstead : undefined}>`.
 */
export function focusPanelInstead(event: Event): void {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus();
  }
}
