# 12 — Identidade visual

> Status: **✅ validado pelo usuário em 2026-09-27** (NBB-26) · Última atualização: 2026-09-27
>
> Prévia interativa usada na validação: [Orçô · Identidade visual](https://claude.ai/artifact/JRPTxH7RcBa5JKNPurATP4) (privada).

## Personalidade

**Profissional e sóbrio no visual; simples e direto na linguagem.** Cores contidas, cantos discretos, tipografia firme, sem sombras decorativas. O texto continua claro e sem jargão (ver [01-visao.md](01-visao.md)): sóbrio, não burocrático.

## Logo

**Ícone:** folha de orçamento dobrada com um visto, num quadrado teal com cantos arredondados. Comunica a função do app mesmo sem ler o nome.

![Ícone do Orçô](identidade/orco-icone.svg)

- Fonte do ícone: [`identidade/orco-icone.svg`](identidade/orco-icone.svg) (48×48, cantos de 10 px).
- **Logotipo completo:** ícone + a palavra **"Orçô"** em Inter 700, espaçamento −0,02em, cor do texto principal. Espaço entre ícone e nome = 1/4 da altura do ícone.
- Versões finais geradas na M2 (NBB-60): favicon (SVG + ICO 32 px), ícones do PWA 192, 512 e *maskable*, `apple-touch-icon` 180 px e versão para o PDF.
- Não distorcer, não trocar as cores do ícone, não aplicar sombra nem contorno.

## Cores

### Marca e neutros

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `primary` | `#0F766E` | `#2DD4BF` | botões principais, links, foco, destaques (5,5:1 no branco) |
| `primary-hover` | `#115E59` | `#5EEAD4` | hover/pressionado |
| `primary-soft` | `#E6F4F2` | `#0F2E2A` | fundos suaves, seleção |
| `on-primary` | `#FFFFFF` | `#042F2E` | texto sobre a primária |
| `bg` | `#F6F8F8` | `#0B1413` | fundo da página |
| `surface` | `#FFFFFF` | `#111D1B` | cartões, campos, painéis |
| `ink` | `#10201E` | `#E6EEEC` | texto principal |
| `muted` | `#51615F` | `#93A5A2` | texto secundário (6,3:1 no branco) |
| `line` | `#D6DFDD` | `#24342F` | bordas e divisores |

Os neutros puxam levemente para o teal, em vez de cinza puro.

### Status (semânticos, separados da marca)

| Status | Texto claro / fundo claro | Texto escuro / fundo escuro | Ícone |
|---|---|---|---|
| Rascunho | `#475569` / `#EEF2F4` | `#A5B4C3` / `#1A2629` | lápis |
| Enviado | `#1D4ED8` / `#DBEAFE` | `#93C5FD` / `#13223F` | avião de papel |
| Aprovado | `#15803D` / `#DCFCE7` | `#4ADE80` / `#0F2A1A` | visto |
| Recusado | `#B91C1C` / `#FEE2E2` | `#F87171` / `#2E1414` | × |
| Expirado | `#B45309` / `#FEF3C7` | `#FBBF24` / `#2E2410` | relógio |

**Regra:** status **sempre com ícone e rótulo**, nunca só cor (acessibilidade). O verde do "Aprovado" é mais escuro e amarelado que o teal da marca, e o ícone desfaz a ambiguidade.

## Tipografia

- **Inter** (Google Fonts / `next/font`), pesos 400, 500, 600 e 700. Fallback: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Números tabulares** (`font-variant-numeric: tabular-nums`) em todos os valores, tabelas, números de orçamento e datas.
- Escala (px): 12 · 13 · 15 (corpo) · 18 · 19 · 28. Títulos com `text-wrap: balance`.
- Rótulos em caixa alta (ex.: cabeçalhos de tabela do PDF): 11–12 px, peso 600, espaçamento +0,05em.

## Forma e profundidade

- **Cantos:** 8 px em botões, campos e cartões; 999 px apenas em selos de status; 10 px no ícone do app.
- **Sombras:** nenhuma no app, apenas bordas `line`. Sombra leve só em sobreposições (modais, menus, bottom sheets).
- **Foco:** contorno de 2 px na cor `primary`, com afastamento de 2 px, sempre visível no teclado.

## Temas

- Tema **Automático** por padrão (segue o sistema), com opção de fixar **Claro** ou **Escuro** no perfil (RNF-16). Implementação: next-themes aplica a classe `.dark` no `<html>`; os tokens são variáveis CSS em `:root` (claro) e `.dark` (escuro), mapeadas no Tailwind/shadcn (`src/app/globals.css`).
- **PDF e página pública do cliente (`/p/[token]`) são sempre claros**, porque funcionam como documento.
- Contraste WCAG AA garantido nos dois temas.

## PDF

- Cabeçalho: logo do **freelancer** (não do Orçô) + nome e contatos; à direita, número, emissão e validade. Filete inferior de 2 px na cor `primary`.
- Tabela de itens com cabeçalho em caixa alta, valores alinhados à direita e tabulares.
- Total em destaque na cor `primary`.
- Caixa neutra com **condições de pagamento** e **prazo de execução** (RN-44).
- Rodapé discreto: dados de pagamento + "Gerado com Orçô".
