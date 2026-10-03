"use client";

import { useState, useTransition } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { saveProfileFieldAction } from "@/features/profile/actions";
import { LogoField } from "@/features/profile/components/logo-field";
import { ProfileTextField } from "@/features/profile/components/profile-field";
import type { ProfileField, ProfileValues } from "@/features/profile/schemas";
import { formatDocument } from "@/lib/document";

// Perfil do freelancer (F-14, NBB-42): a prévia do cabeçalho no topo (D5) e as seções (D6), com o
// logo (NBB-81). Cada campo se salva sozinho ao perder o foco (D3); a prévia acompanha o que foi salvo.

const text = (value: string | number | null) => (value === null ? "" : String(value));

export function ProfileForm({
  initial,
  initialLogoUrl,
  accountEmail,
}: {
  initial: ProfileValues;
  initialLogoUrl: string | null;
  accountEmail: string;
}) {
  const [values, setValues] = useState(initial);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);

  function onSaved(field: ProfileField) {
    return (value: ProfileValues[ProfileField]) =>
      setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-10">
      <HeaderPreview values={values} logoUrl={logoUrl} accountEmail={accountEmail} />

      <FieldSet>
        <FieldLegend>Sua marca</FieldLegend>
        <FieldGroup>
          <LogoField logoUrl={logoUrl} onChange={setLogoUrl} />
          <ProfileTextField
            field="displayName"
            label="Seu nome"
            value={text(values.displayName)}
            onSaved={onSaved("displayName")}
            autoComplete="name"
          />
          <ProfileTextField
            field="businessName"
            label="Nome comercial"
            value={text(values.businessName)}
            onSaved={onSaved("businessName")}
            description="Se preenchido, é o nome que aparece no orçamento."
            autoComplete="organization"
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Contato</FieldLegend>
        <FieldGroup>
          <ProfileTextField
            field="phone"
            label="Telefone"
            value={text(values.phone)}
            onSaved={onSaved("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
          />
          <ProfileTextField
            field="contactEmail"
            label="E-mail de contato"
            value={text(values.contactEmail)}
            onSaved={onSaved("contactEmail")}
            type="email"
            inputMode="email"
            autoComplete="email"
          />
          <ProfileTextField
            field="website"
            label="Site"
            value={text(values.website)}
            onSaved={onSaved("website")}
            inputMode="url"
            placeholder="meusite.com.br"
          />
          <ProfileTextField
            field="instagram"
            label="Instagram"
            value={text(values.instagram)}
            onSaved={onSaved("instagram")}
            placeholder="@meunegocio"
          />
          <ProfileTextField
            field="document"
            label="CPF ou CNPJ"
            value={values.document ? formatDocument(values.document) : ""}
            onSaved={onSaved("document")}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Pagamento</FieldLegend>
        <ProfileTextField
          field="paymentInfo"
          label="Dados de pagamento"
          value={text(values.paymentInfo)}
          onSaved={onSaved("paymentInfo")}
          multiline
          placeholder="Pix: chave…"
          description="Para onde o cliente paga. Só informativo: o Orçô não processa pagamentos."
        />
      </FieldSet>

      <FieldSet>
        <FieldLegend>Padrões dos orçamentos</FieldLegend>
        <FieldGroup>
          <ProfileTextField
            field="defaultValidityDays"
            label="Validade (dias)"
            value={text(values.defaultValidityDays)}
            onSaved={onSaved("defaultValidityDays")}
            type="number"
            inputMode="numeric"
            description="Cada orçamento novo vence hoje + este número de dias."
          />
          <ProfileTextField
            field="defaultNotes"
            label="Observações"
            value={text(values.defaultNotes)}
            onSaved={onSaved("defaultNotes")}
            multiline
          />
          <ProfileTextField
            field="defaultPaymentTerms"
            label="Condições de pagamento"
            value={text(values.defaultPaymentTerms)}
            onSaved={onSaved("defaultPaymentTerms")}
            multiline
            placeholder="50% na entrada, 50% na entrega"
          />
          <ProfileTextField
            field="defaultDeliveryTime"
            label="Prazo de execução"
            value={text(values.defaultDeliveryTime)}
            onSaved={onSaved("defaultDeliveryTime")}
            multiline
            placeholder="15 dias úteis após a aprovação"
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Notificações</FieldLegend>
        <EmailNotificationsSwitch
          checked={values.emailNotifications}
          onSaved={onSaved("emailNotifications")}
        />
      </FieldSet>
    </div>
  );
}

/** RN-41: um único botão liga ou desliga os e-mails de respostas e lembretes. Salva ao tocar. */
function EmailNotificationsSwitch({
  checked,
  onSaved,
}: {
  checked: boolean;
  onSaved: (value: ProfileValues[ProfileField]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="profile-emailNotifications">Notificações por e-mail</FieldLabel>
        <FieldDescription>Respostas dos clientes e lembretes de vencimento.</FieldDescription>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </FieldContent>
      <Switch
        id="profile-emailNotifications"
        checked={checked}
        disabled={pending}
        onCheckedChange={(next) =>
          startTransition(async () => {
            const result = await saveProfileFieldAction("emailNotifications", next);
            if (result.status === "saved") {
              setError(null);
              onSaved(result.value);
            } else {
              setError(result.message);
            }
          })
        }
      />
    </Field>
  );
}

/** Prévia do cabeçalho do orçamento (D5). Nome pela ordem da RN-04: comercial → seu nome → e-mail. */
function HeaderPreview({
  values,
  logoUrl,
  accountEmail,
}: {
  values: ProfileValues;
  logoUrl: string | null;
  accountEmail: string;
}) {
  const name = values.businessName ?? values.displayName ?? accountEmail;
  const contacts = [
    values.phone,
    values.contactEmail,
    values.website?.replace(/^https?:\/\//, ""),
    values.instagram,
    values.document ? formatDocument(values.document) : null,
  ].filter(Boolean);

  return (
    <section aria-label="Prévia do cabeçalho do orçamento" className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Como o cliente vê
      </p>
      <div className="flex items-center gap-4 rounded-lg border border-b-2 border-border border-b-primary p-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem da nossa própria rota, já pequena
          <img src={logoUrl} alt="" className="size-14 shrink-0 object-contain" />
        ) : null}
        <div className="min-w-0">
          <p className="text-lg font-semibold">{name}</p>
          {contacts.length > 0 ? (
            <p className="text-sm text-muted-foreground">{contacts.join(" · ")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Preencha os campos abaixo para o orçamento ficar com a sua cara.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
