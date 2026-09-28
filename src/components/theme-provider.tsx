"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Tema claro/escuro (RNF-16): padrão "Automático" (segue o sistema); o usuário pode fixar
 * Claro ou Escuro no perfil. A escolha fica salva no navegador (localStorage).
 * O `nonce` da CSP chega pelas props (src/app/layout.tsx) e libera o script inline anti-piscada.
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
