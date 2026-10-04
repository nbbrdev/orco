import type { QuoteDocumentModel } from "@/pdf/model";

// O orçamento como o cliente vê (F-07, NBB-53 P4): os mesmos textos do PDF, montados pelo
// buildQuoteDocument (src/pdf/model.ts). Só mostra: não tem estado, então serve à página pública e,
// no PR 2, ao editor em modo leitura (P8-A).
// - Cabeçalho: logo, nome e contatos do freelancer; número, emissão e validade; filete na cor
//   principal (doc 12).
// - Itens: no celular, um bloco por item; no computador, uma tabela. Desconto só se existir (RN-15b).

export function PublicQuoteView({
  model,
  logoUrl,
}: {
  model: QuoteDocumentModel;
  /** Endereço público do logo (/api/p/logos/…), ou nulo. */
  logoUrl: string | null;
}) {
  const terms = [
    { label: "Condições de pagamento", value: model.paymentTerms },
    { label: "Prazo de execução", value: model.deliveryTime },
  ].filter((entry) => entry.value);

  return (
    <article className="flex flex-col gap-8" aria-label={`Orçamento Nº ${model.number}`}>
      <header className="flex flex-col gap-4 border-b-2 border-primary pb-5 sm:flex-row sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem da nossa própria rota, já pequena
            <img src={logoUrl} alt="" className="size-14 shrink-0 object-contain" />
          ) : null}
          <div className="min-w-0">
            {model.issuer.name ? (
              <p className="text-lg font-semibold break-words">{model.issuer.name}</p>
            ) : null}
            {model.issuer.contacts.map((contact) => (
              <p key={contact} className="text-sm break-words text-muted-foreground">
                {contact}
              </p>
            ))}
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <h1 className="text-xl font-semibold">Orçamento Nº {model.number}</h1>
          <p className="text-sm text-muted-foreground">Emitido em {model.issuedAt}</p>
          <p className="text-sm text-muted-foreground">Válido até {model.validUntil}</p>
        </div>
      </header>

      {model.client ? (
        <section aria-label="Cliente">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Para
          </p>
          <p className="font-medium break-words">{model.client.name}</p>
          {model.client.contacts.length > 0 ? (
            <p className="text-sm break-words text-muted-foreground">
              {model.client.contacts.join(" · ")}
            </p>
          ) : null}
          {model.client.address ? (
            <p className="text-sm break-words text-muted-foreground">{model.client.address}</p>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Itens">
        {/* Celular: um bloco por item. */}
        <ul className="flex flex-col divide-y divide-border border-y border-border md:hidden">
          {model.lines.map((line, index) => (
            <li key={index} className="flex flex-col gap-1 py-3">
              <p className="break-words">{line.description}</p>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {line.quantity}
                  {line.unit ? ` ${line.unit}` : ""} × {line.unitPrice}
                  {line.discount ? ` (${line.discount})` : ""}
                </span>
                <span className="font-medium tabular-nums">{line.total}</span>
              </div>
            </li>
          ))}
        </ul>

        {/* Computador: tabela. */}
        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="border-b border-foreground text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-2 pr-3 text-left font-semibold">Descrição</th>
              <th className="py-2 text-right font-semibold">Qtd.</th>
              <th className="py-2 pl-2 text-left font-semibold">Un.</th>
              <th className="py-2 text-right font-semibold">Valor unit.</th>
              {model.showItemDiscount ? (
                <th className="py-2 text-right font-semibold">Desconto</th>
              ) : null}
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((line, index) => (
              <tr key={index} className="border-b border-border align-top">
                <td className="py-2 pr-3 break-words">{line.description}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="py-2 pl-2">{line.unit}</td>
                <td className="py-2 text-right tabular-nums">{line.unitPrice}</td>
                {model.showItemDiscount ? (
                  <td className="py-2 text-right tabular-nums">{line.discount}</td>
                ) : null}
                <td className="py-2 text-right tabular-nums">{line.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 ml-auto flex w-full flex-col gap-1 text-sm md:max-w-xs">
          {"subtotal" in model.totals ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{model.totals.subtotal}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Desconto</dt>
                <dd className="tabular-nums">{model.totals.discount}</dd>
              </div>
            </>
          ) : null}
          <div className="mt-1 flex justify-between text-lg font-semibold text-primary">
            <dt>Total</dt>
            <dd className="tabular-nums">{model.totals.total}</dd>
          </div>
        </dl>
      </section>

      {terms.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-lg bg-muted p-4" aria-label="Condições">
          {terms.map((entry) => (
            <div key={entry.label}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {entry.label}
              </p>
              <p className="whitespace-pre-line">{entry.value}</p>
            </div>
          ))}
        </section>
      ) : null}

      {model.notes ? (
        <section aria-label="Observações">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Observações
          </p>
          <p className="whitespace-pre-line">{model.notes}</p>
        </section>
      ) : null}

      {model.paymentInfo ? (
        <section aria-label="Dados de pagamento">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Dados de pagamento
          </p>
          <p className="whitespace-pre-line text-muted-foreground">{model.paymentInfo}</p>
        </section>
      ) : null}
    </article>
  );
}
