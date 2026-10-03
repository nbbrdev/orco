"use client";

import { ImageIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { removeLogoAction, uploadLogoAction } from "@/features/profile/actions";
import { LOGO_ACCEPTED_TYPES, LOGO_MAX_BYTES, LOGO_MAX_SIDE } from "@/features/profile/logo-rules";

// Logo do freelancer (RN-05, NBB-81). O navegador reduz a imagem (lado maior até 1024 px) e tenta
// WebP; o Safari não gera WebP pelo canvas e devolve PNG, que mantém a transparência (L2). O servidor
// confere de novo o tipo e o tamanho.

const INVALID_FILE = "Use uma imagem PNG, JPEG ou WebP de até 5 MB.";

/** Reduz a imagem e devolve o arquivo a enviar (WebP, ou PNG onde o navegador não gera WebP). */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  const webp = await toBlob("image/webp");
  if (webp?.type === "image/webp") return webp;
  const png = await toBlob("image/png");
  if (!png) throw new Error("O navegador não conseguiu preparar a imagem.");
  return png;
}

export function LogoField({
  logoUrl,
  onChange,
}: {
  logoUrl: string | null;
  onChange: (logoUrl: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (
      !(LOGO_ACCEPTED_TYPES as readonly string[]).includes(file.type) ||
      file.size > LOGO_MAX_BYTES
    ) {
      setError(INVALID_FILE);
      return;
    }
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("logo", await shrink(file));
        const result = await uploadLogoAction(form);
        if (result.status === "saved") {
          setError(null);
          onChange(result.logoUrl);
        } else {
          setError(result.message);
        }
      } catch {
        setError(INVALID_FILE);
      }
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeLogoAction();
      if (result.status === "saved") {
        setError(null);
        onChange(null);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Logo</span>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem da nossa própria rota, já pequena
            <img src={logoUrl} alt="Seu logo" className="size-full object-contain" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? "Enviando…" : logoUrl ? "Trocar" : "Enviar logo"}
          </Button>
          {logoUrl ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={onRemove}>
              Remover
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={LOGO_ACCEPTED_TYPES.join(",")}
        className="sr-only"
        aria-label="Arquivo do logo"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <p className="text-sm text-muted-foreground">PNG, JPEG ou WebP, até 5 MB.</p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
