"use client";

import { Plus } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { createQuoteAction } from "@/features/quotes/actions";
import { cn } from "@/lib/utils";

// "Novo orçamento" (NBB-86 P1-A): um formulário que chama a Server Action, e não um link, para o
// pré-carregamento de links do Next nunca criar rascunhos. Funciona até sem JavaScript.

type Variant = "default" | "fab" | "large";

export function NewQuoteButton({
  variant = "default",
  children = "Novo orçamento",
}: {
  variant?: Variant;
  children?: React.ReactNode;
}) {
  return (
    <form action={createQuoteAction}>
      <SubmitButton variant={variant}>{children}</SubmitButton>
    </form>
  );
}

function SubmitButton({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  const { pending } = useFormStatus();

  if (variant === "fab") {
    return (
      <button
        type="submit"
        aria-label="Novo orçamento"
        disabled={pending}
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors outline-none hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 md:hidden"
      >
        <Plus className="size-6" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Button type="submit" disabled={pending} size={variant === "large" ? "lg" : "default"}>
      <Plus aria-hidden="true" className={cn(variant === "large" && "size-5")} />
      {children}
    </Button>
  );
}
