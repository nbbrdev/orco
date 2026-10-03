"use client";

import { useLayoutEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { caretAfterMask, countSignificant } from "@/lib/masks";

// Campo de texto com máscara (NBB-84): formata enquanto a pessoa digita e devolve o cursor para o
// mesmo ponto do número, em vez de jogá-lo para o fim (M4-A).

type MaskedInputProps = Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> & {
  value: string;
  mask: (value: string) => string;
  onValueChange: (value: string) => void;
};

export function MaskedInput({ value, mask, onValueChange, ...props }: MaskedInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  // Posição do cursor a aplicar depois que o React mostrar o valor formatado.
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const input = ref.current;
    if (input && pendingCaret.current !== null && document.activeElement === input) {
      input.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [value]);

  return (
    <Input
      {...props}
      ref={ref}
      value={value}
      onChange={(event) => {
        const raw = event.target.value;
        const formatted = mask(raw);
        const caret = event.target.selectionStart ?? raw.length;
        const next = caretAfterMask(formatted, countSignificant(raw, caret));
        if (formatted === value) {
          // Nada mudou (ex.: uma letra no telefone, que a máscara descarta): o React só restaura o
          // texto, e o cursor volta ao lugar no quadro seguinte.
          const input = event.target;
          requestAnimationFrame(() => input.setSelectionRange(next, next));
          return;
        }
        pendingCaret.current = next;
        onValueChange(formatted);
      }}
    />
  );
}
