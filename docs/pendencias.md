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
| P-07 | Texto dos termos de uso e da política de privacidade | Não (até M7) |
| P-08 | Identidade visual: cores, logo do Orçô, tipografia | Não (até M2) |

## Infra

| # | Pergunta | Bloqueante? |
|---|---|---|
| P-09 | ~~Subdomínio e DNS~~ **Resolvido:** `orco.nbbrdev.com`, DNS na Hostinger. | — |
| P-10 | ~~URL do repositório~~ **Resolvido:** `nbbrdev/orco` (público). | — |
| P-11 | ~~Supabase local via Docker ou projeto dev na nuvem?~~ **Resolvido:** local via Docker (Supabase CLI + Docker Desktop). | — |
| P-12 | ~~Dois projetos Supabase?~~ **Resolvido:** `orco-staging` (previews) + `orco-prod`; local no Docker (ADR-0008). | — |
| P-13 | Remetente de e-mail (sugestão: `nao-responda@orco.nbbrdev.com`) | Não (até M2) |
| P-14 | Destino dos backups criptografados | Não (até M7) |
| P-15 | Vercel Hobby é só para uso não comercial: ok no MVP gratuito? | Não |
| P-16 | ~~Proteção contra senhas vazadas~~ **Resolvido:** fica sem; risco aceito no ADR-0002, reavaliar na M7. | — |
