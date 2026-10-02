import { FieldDescription } from "@/components/ui/field";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schemas";

// Requisito da senha visível enquanto a pessoa digita (F-01, F-04). O `id` liga a dica ao campo pelo
// aria-describedby.
export function PasswordHint({ id, length }: { id: string; length: number }) {
  return (
    <FieldDescription id={id}>
      {length >= PASSWORD_MIN_LENGTH
        ? `✓ Senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
        : `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres (${length}/${PASSWORD_MIN_LENGTH}).`}
    </FieldDescription>
  );
}
