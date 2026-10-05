# Pendências

> Perguntas em aberto. Cada uma vira issue `docs` na M0 do Linear. **Bloqueante** = impede o início da M1.
> Última atualização: 2026-09-27

## Validações (bloqueantes)

| # | Item | Onde |
|---|---|---|
| P-01 | ~~Validar cada fluxo F-01 a F-17~~ **Resolvido:** todos validados em 2026-09-27. | — |
| P-02 | ~~Validar cada regra RN-01 a RN-42~~ **Resolvido:** todas validadas em 2026-09-27. | — |
| P-03 | ~~Validar ADRs propostos~~ **Resolvido:** todos os ADRs 0001–0008 aceitos. | — |
| P-04 | ~~Validar escopo, delimitações e o atalho de WhatsApp~~ **Resolvido:** validado em 2026-09-27; entraram PWA, push, lembrete de vencimento, condições/prazo e tema escuro (ADR-0009). | — |

## Produto

| # | Pergunta | Bloqueante? |
|---|---|---|
| P-05 | ~~Limites de uso por conta~~ **Resolvido:** 200 orçamentos/mês, 1.000 clientes, 500 itens (RN-38). | — |
| P-06 | ~~Retenção do IP~~ **Resolvido:** 12 meses (RN-37). | — |
| P-07 | ~~Texto dos termos de uso e da política de privacidade~~ **Resolvido:** `/termos` e `/privacidade` (NBB-30, 2026-10-04), sem revisão jurídica. | — |
| P-08 | ~~Identidade visual~~ **Resolvido:** teal + Inter + ícone de documento com visto, tom sóbrio ([12-identidade-visual.md](12-identidade-visual.md)). | — |

## Infra

| # | Pergunta | Bloqueante? |
|---|---|---|
| P-09 | ~~Subdomínio e DNS~~ **Resolvido:** `orco.nbbrdev.com`, DNS na Hostinger. | — |
| P-10 | ~~URL do repositório~~ **Resolvido:** `nbbrdev/orco` (público). | — |
| P-11 | ~~Supabase local via Docker ou projeto dev na nuvem?~~ **Resolvido:** local via Docker. **Revisão (2026-09-29):** sem Supabase; Postgres, RustFS e Mailpit locais pelo `compose.dev.yaml` (ADR-0014). | — |
| P-12 | ~~Dois projetos Supabase?~~ **Resolvido:** `orco-staging` + `orco-prod` (ADR-0008). **Revisão (2026-09-29):** um Postgres por ambiente na VPS (ADR-0012/0014). | — |
| P-13 | ~~Remetente de e-mail~~ **Resolvido:** `Orçô <nao-responda@orco.nbbrdev.com>`, sem Reply-To. | — |
| P-14 | ~~Destino dos backups~~ **Resolvido (revisto em 2026-09-30):** sem backup automático; backup manual do banco pelo DBeaver (túnel SSH) antes de cada release (a partir da `v1.0.0`, revisto em 2026-10-05), guardado só no computador do dono. RustFS fora. | — |
| P-15 | ~~Vercel Hobby~~ **Resolvido:** Hobby no MVP; migração para VPS após o `1.0.0` (ADR-0011). **Revisão (2026-09-29):** VPS desde a M1, sem Vercel nem Supabase (ADR-0012). | — |
| P-16 | ~~Proteção contra senhas vazadas~~ **Resolvido:** fica sem; risco aceito no ADR-0002, reavaliar na M7. | — |
