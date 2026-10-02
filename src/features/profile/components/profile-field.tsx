"use client";

import { useState, useTransition } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProfileFieldAction } from "@/features/profile/actions";
import type { ProfileField, ProfileValues } from "@/features/profile/schemas";

// Um campo do perfil com salvamento automático ao sair dele (NBB-42 D3): se o texto mudou, manda só
// este campo ao servidor e mostra "Salvando… / Salvo ✓" ou o erro embaixo.

type TextFieldProps = {
  field: ProfileField;
  label: string;
  value: string;
  onSaved: (value: ProfileValues[ProfileField]) => void;
  description?: string;
  placeholder?: string;
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: "text" | "email" | "tel" | "number";
  autoComplete?: string;
};

export function ProfileTextField({
  field,
  label,
  value,
  onSaved,
  description,
  placeholder,
  multiline,
  inputMode,
  type = "text",
  autoComplete = "off",
}: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (draft === saved) return;
    startTransition(async () => {
      const result = await saveProfileFieldAction(field, draft);
      if (result.status === "saved") {
        // O servidor devolve o valor já limpo (ex.: @usuario, https://…): o campo mostra como ficou.
        const shown = result.value === null ? "" : String(result.value);
        setDraft(shown);
        setSaved(shown);
        setStatus("saved");
        setError(null);
        onSaved(result.value);
      } else {
        setStatus("error");
        setError(result.message);
      }
    });
  }

  const id = `profile-${field}`;
  const describedBy = description ? `${id}-description` : undefined;
  const common = {
    id,
    value: draft,
    placeholder,
    "aria-invalid": status === "error",
    "aria-describedby": describedBy,
    onBlur: save,
  };

  return (
    <Field data-invalid={status === "error"}>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <span role="status" className="text-xs text-muted-foreground">
          {pending ? "Salvando…" : status === "saved" ? "Salvo ✓" : ""}
        </span>
      </div>
      {multiline ? (
        <Textarea {...common} rows={3} onChange={(event) => setDraft(event.target.value)} />
      ) : (
        <Input
          {...common}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      {description ? <FieldDescription id={describedBy}>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
