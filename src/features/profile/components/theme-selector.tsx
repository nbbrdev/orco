"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

// Tema (RNF-16, F-14, NBB-60 W7): Automático (segue o aparelho), Claro ou Escuro. Vale na hora e fica
// salvo neste aparelho (next-themes, localStorage).

const OPTIONS = [
  { value: "system", label: "Automático", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
] as const;

const noSubscription = () => () => {};

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  // O tema escolhido só é conhecido no navegador: no servidor (e até hidratar), nenhum botão aparece
  // marcado, para não piscar a opção errada.
  const mounted = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
