# 03 — Requisitos

> Status: rascunho para validação · Última atualização: 2026-09-27
>
> RF = requisito funcional · RNF = requisito não funcional. Referências cruzadas: RN ([09-regras-negocio.md](09-regras-negocio.md)) e F ([10-fluxos.md](10-fluxos.md)).

## Requisitos funcionais

### Conta (M2)
| # | Requisito | Refs |
|---|---|---|
| RF-01 | Cadastro por e-mail + senha, com confirmação de e-mail. | F-01, RN-02, RN-03 |
| RF-02 | Cadastro/login com Google OAuth. | F-02 |
| RF-03 | Login por e-mail + senha. | F-03 |
| RF-04 | Recuperação de senha por e-mail. | F-04 |
| RF-05 | CAPTCHA Turnstile no cadastro. | F-01 |
| RF-06 | Logout. | — |
| RF-07 | Exclusão de conta com confirmação e remoção de todos os dados. | F-17, RN-06 |

### Perfil (M2)
| # | Requisito | Refs |
|---|---|---|
| RF-08 | Editar dados do perfil, todos opcionais. | F-14, RN-04 |
| RF-09 | Upload, troca e remoção de logo. | F-14, RN-05 |
| RF-10 | Configurar padrões: validade (dias), observações, condições de pagamento e prazo de execução. | F-14, RN-19, RN-44 |

### Clientes (M3)
| # | Requisito | Refs |
|---|---|---|
| RF-11 | CRUD de clientes com busca por nome, e-mail ou documento. | F-15, RN-07, RN-08 |
| RF-12 | Criar cliente inline no editor de orçamento. | F-05 |
| RF-13 | Listar os orçamentos de um cliente. | F-15 |

### Catálogo (M3)
| # | Requisito | Refs |
|---|---|---|
| RF-14 | CRUD de itens do catálogo com busca. | F-16, RN-10 |
| RF-15 | Autocompletar itens do catálogo no editor. | F-05 |
| RF-16 | Salvar no catálogo um item novo digitado no editor. | F-05 |

### Orçamentos (M4)
| # | Requisito | Refs |
|---|---|---|
| RF-17 | Criar orçamento (rascunho) com número sequencial. | F-05, RN-12 |
| RF-18 | Editor com itens dinâmicos, desconto, validade e observações. | F-05, RN-13–RN-19 |
| RF-19 | Cálculo de subtotal, desconto e total em tempo real. | RN-15–RN-18 |
| RF-20 | Salvamento automático. | RN-21 |
| RF-21 | Snapshot dos dados de cliente e itens. | RN-20 |
| RF-22 | Ciclo de status, envio automático ao compartilhar e versão interna. | RN-22–RN-27 |
| RF-23 | Lista com filtro por status e busca. | F-09 |
| RF-24 | Duplicar orçamento. | F-12, RN-28 |
| RF-25 | Excluir orçamento. | F-13, RN-29 |
| RF-26 | Prorrogar validade. | F-11, RN-27 |
| RF-26a | Campos de condições de pagamento e prazo de execução no orçamento, exibidos no PDF e no link. | F-05, RN-44 |

### PDF (M5)
| # | Requisito | Refs |
|---|---|---|
| RF-27 | Gerar PDF com a marca do freelancer (dono e cliente final). | F-06, F-07 |
| RF-27a | Prévia do PDF na tela para o freelancer, sem alterar o status. | F-06, RN-22a |

### Link público (M6)
| # | Requisito | Refs |
|---|---|---|
| RF-28 | Copiar o link público do orçamento. | F-06, RN-30 |
| RF-29 | Página pública do orçamento, sem login. | F-07, RN-31 |
| RF-30 | Aprovar e recusar, com registro de evidência. | F-07, F-08, RN-32–RN-34 |
| RF-31 | Registrar e exibir "visualizado". | RN-35 |
| RF-32 | Regenerar link. | F-13, RN-36 |
| RF-33 | Atalho de compartilhar no WhatsApp. | F-06 |
| RF-33a | E-mail ao freelancer na aprovação/recusa, com opção de desligar no perfil. | F-07, F-08, RN-40–RN-42 |

### Notificações (M6)
| # | Requisito | Refs |
|---|---|---|
| RF-37 | Lembrete diário de vencimento (e-mail + push) via Vercel Cron. | RN-43 |
| RF-38 | Notificações push (Web Push): pedido de permissão após o 1º envio, ativação por aparelho, eventos de resposta, lembrete e visualização. | F-18, RN-45 |

### Plataforma (M7)
| # | Requisito | Refs |
|---|---|---|
| RF-34 | Páginas de termos de uso e política de privacidade. | — |
| RF-35 | Limites de uso por conta e rate limit nas rotas públicas e de PDF. | RN-38, RN-39 |
| RF-36 | PWA instalável: manifest, ícones e service worker, sem modo offline. | — |
| RF-39 | Versão atual exibida no rodapé do perfil ("Orçô vX.Y.Z"), com link para as notas da versão. | F-14, ADR-0010 |

## Requisitos não funcionais

### Usabilidade (princípio central, ver [01-visao.md](01-visao.md))
| # | Requisito |
|---|---|
| RNF-01 | Do cadastro ao 1º link copiado em **< 2 min** por um usuário novo, sem ajuda. Medido em teste de usabilidade na M7. |
| RNF-02 | Cada fluxo respeita o orçamento de simplicidade definido em [10-fluxos.md](10-fluxos.md). |
| RNF-03 | Mobile-first: todas as telas usáveis a partir de 360 px de largura; alvos de toque ≥ 44 px; ações principais ao alcance do polegar. |
| RNF-04 | Toda lista tem estado vazio com orientação e ação. Todo erro diz o que fazer. |
| RNF-05 | Textos em pt-BR simples; datas `dd/mm/aaaa`; valores `R$ 1.234,56`. |
| RNF-06 | Acessibilidade WCAG 2.1 AA: contraste, navegação por teclado, labels, foco visível. |
| RNF-16 | Tema claro/escuro automático (`prefers-color-scheme`), com contraste AA nos dois. O PDF é sempre claro. |

### Performance
| # | Requisito |
|---|---|
| RNF-07 | LCP < 2,5 s e INP < 200 ms (p75, 4G) em `/app/orcamentos`, no editor e em `/p/[token]`. |
| RNF-08 | Mutações com UI otimista; salvamento automático com debounce, sem bloquear a digitação. |
| RNF-09 | PDF gerado em < 3 s (p95). |

### Segurança e privacidade
| # | Requisito |
|---|---|
| RNF-10 | Todos os requisitos de [07-seguranca.md](07-seguranca.md). |
| RNF-11 | Conformidade com a LGPD: finalidade, minimização, exclusão, política publicada. |

### Operação e qualidade
| # | Requisito |
|---|---|
| RNF-12 | Operação dentro dos planos gratuitos (Vercel Hobby, Supabase Free, Resend Free) no MVP. |
| RNF-13 | CI verde (lint, typecheck, testes, build, CodeQL) obrigatório para merge. |
| RNF-14 | Regras de cálculo (RN-15–RN-18) com 100% de cobertura em testes unitários. |
| RNF-15 | Fluxos F-01, F-05, F-06, F-07 e F-08 cobertos por testes E2E (Playwright). |
