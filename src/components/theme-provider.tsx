"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Tema claro/escuro (RNF-16): padrão "Automático" (segue o sistema); o usuário pode fixar
 * Claro ou Escuro no perfil. A escolha fica salva no navegador (localStorage).
 * O `nonce` da CSP deve ser repassado aqui quando a NBB-36 for implementada.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    />
  );
}
