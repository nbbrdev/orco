import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { QuoteDocumentModel } from "./model";

// O PDF do orçamento (RF-27, NBB-50), no leiaute do doc 12: sempre claro, A4, Inter.
// - Cabeçalho: logo e nome do freelancer com os contatos; à direita, número, emissão e validade;
//   filete de 2 pt na cor principal.
// - Cliente (se houver), tabela de itens (desconto só se existir, RN-15b) e totais, com o total em
//   destaque na cor principal.
// - Caixa neutra com condições de pagamento e prazo de execução (RN-44), observações e, no fim, os
//   dados de pagamento (RN-04). Rodapé fixo em todas as páginas: "Gerado com Orçô" (N5-A).

// Os tokens do tema claro (src/app/globals.css).
const COLORS = {
  text: "#10201e",
  muted: "#51615f",
  border: "#d6dfdd",
  primary: "#0f766e",
  surface: "#eef2f1",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 10,
    color: COLORS.text,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 24,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  issuer: { flexDirection: "row", gap: 12, flex: 1 },
  logo: { maxWidth: 120, maxHeight: 56, objectFit: "contain" },
  issuerName: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  muted: { color: COLORS.muted },
  meta: { alignItems: "flex-end" },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  label: {
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginBottom: 2,
  },
  section: { marginTop: 18 },
  table: { marginTop: 18 },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerRow: { paddingVertical: 4, borderBottomColor: COLORS.text },
  description: { flex: 1, paddingRight: 8 },
  quantity: { width: 44, textAlign: "right" },
  unit: { width: 36, paddingLeft: 6 },
  unitPrice: { width: 80, textAlign: "right" },
  discount: { width: 70, textAlign: "right" },
  total: { width: 80, textAlign: "right" },
  totals: { marginTop: 12, marginLeft: "auto", width: 230 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotal: { fontSize: 14, fontWeight: 700, color: COLORS.primary },
  box: {
    marginTop: 18,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    gap: 8,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "center",
  },
});

export function QuoteDocument({ model }: { model: QuoteDocumentModel }) {
  const terms = [
    { label: "Condições de pagamento", value: model.paymentTerms },
    { label: "Prazo de execução", value: model.deliveryTime },
  ].filter((entry) => entry.value);

  return (
    <Document title={`Orçamento Nº ${model.number}`} author={model.issuer.name} language="pt-BR">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.issuer}>
            {model.issuer.logoPng ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- o Image do react-pdf não tem alt.
              <Image
                style={styles.logo}
                src={{ data: Buffer.from(model.issuer.logoPng), format: "png" }}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.issuerName}>{model.issuer.name}</Text>
              {model.issuer.contacts.map((contact) => (
                <Text key={contact} style={styles.muted}>
                  {contact}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.meta}>
            <Text style={styles.title}>Orçamento Nº {model.number}</Text>
            <Text style={styles.muted}>Emitido em {model.issuedAt}</Text>
            <Text style={styles.muted}>Válido até {model.validUntil}</Text>
          </View>
        </View>

        {model.client ? (
          <View style={styles.section}>
            <Text style={styles.label}>Para</Text>
            <Text style={{ fontWeight: 600 }}>{model.client.name}</Text>
            {model.client.contacts.length > 0 ? (
              <Text style={styles.muted}>{model.client.contacts.join(" · ")}</Text>
            ) : null}
            {model.client.address ? <Text style={styles.muted}>{model.client.address}</Text> : null}
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} fixed>
            <Text style={[styles.label, styles.description]}>Descrição</Text>
            <Text style={[styles.label, styles.quantity]}>Qtd.</Text>
            <Text style={[styles.label, styles.unit]}>Un.</Text>
            <Text style={[styles.label, styles.unitPrice]}>Valor unit.</Text>
            {model.showItemDiscount ? (
              <Text style={[styles.label, styles.discount]}>Desconto</Text>
            ) : null}
            <Text style={[styles.label, styles.total]}>Total</Text>
          </View>
          {model.lines.map((line, index) => (
            // Um item nunca é cortado entre duas páginas.
            <View key={index} style={styles.row} wrap={false}>
              <Text style={styles.description}>{line.description}</Text>
              <Text style={styles.quantity}>{line.quantity}</Text>
              <Text style={styles.unit}>{line.unit}</Text>
              <Text style={styles.unitPrice}>{line.unitPrice}</Text>
              {model.showItemDiscount ? <Text style={styles.discount}>{line.discount}</Text> : null}
              <Text style={styles.total}>{line.total}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          {"subtotal" in model.totals ? (
            <>
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>Subtotal</Text>
                <Text>{model.totals.subtotal}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.muted}>Desconto</Text>
                <Text>{model.totals.discount}</Text>
              </View>
            </>
          ) : null}
          <View style={[styles.totalsRow, { marginTop: 4 }]}>
            <Text style={styles.grandTotal}>Total</Text>
            <Text style={styles.grandTotal}>{model.totals.total}</Text>
          </View>
        </View>

        {terms.length > 0 ? (
          <View style={styles.box} wrap={false}>
            {terms.map((entry) => (
              <View key={entry.label}>
                <Text style={styles.label}>{entry.label}</Text>
                <Text>{entry.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {model.notes ? (
          <View style={styles.section}>
            <Text style={styles.label}>Observações</Text>
            <Text>{model.notes}</Text>
          </View>
        ) : null}

        {model.paymentInfo ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.label}>Dados de pagamento</Text>
            <Text style={styles.muted}>{model.paymentInfo}</Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Gerado com Orçô
        </Text>
      </Page>
    </Document>
  );
}
