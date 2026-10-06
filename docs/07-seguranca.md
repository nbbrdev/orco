# 07 — Segurança

> Status: rascunho para validação · Última atualização: 2026-09-29
>
> As regras deste documento são **obrigatórias**. Um PR que viole qualquer uma delas não é aprovado.
>
> **2026-09-29:** revisado para a arquitetura em VPS, sem Supabase e sem Vercel (ADR-0012 a 0016).

## 1. Senhas e autenticação (ADR-0013)

- **Senhas só pelo Better Auth.** Ele faz o hash (scrypt ou argon2, lento de propósito) e guarda nas tabelas do schema `auth`, acessíveis só pela role `app_auth`. É proibido criar outra tabela de senha, fazer hash próprio fora da biblioteca ou logar senhas.
- Métodos: e-mail + senha e Google OAuth.
- Confirmação de e-mail obrigatória para cadastro por senha (RN-02).
- Política de senha: mínimo de 8 caracteres, sem exigência de tipos (RN-03), aplicada pelo Zod no servidor e pela configuração do Better Auth. Risco aceito (ADR-0002/0013).
- Proteção contra senhas vazadas (HaveIBeenPwned): **não** no MVP. Risco aceito, a reavaliar na M7. **Reavaliado em 2026-10-04 (NBB-57 S3):** continua sem; ver §15.
- **Cadastro protegido sem CAPTCHA externo** (RN-46, decidido em 2026-09-29): a Server Action de cadastro, **antes** de criar a conta, confere:
  - o **limite por IP** (3 por hora);
  - o **campo "isca" (honeypot)**: escondido por CSS, `aria-hidden`, `tabindex="-1"` e `autocomplete="off"`, com um nome que não pareça e-mail nem senha, para gerenciadores de senha e leitores de tela não o preencherem. Preenchido = robô: responde com a tela de sucesso, sem criar conta nem enviar e-mail;
  - o **teto diário de e-mails de cadastro** (60/dia), que protege a cota do Resend Free para recuperação de senha e avisos.

  Risco aceito: um ataque vindo de muitos IPs ainda passa. Se houver abuso, reavaliar um CAPTCHA que rode no nosso servidor (ex.: ALTCHA), sem conta em terceiros. **Reavaliado em 2026-10-04 (NBB-57 S3):** continua sem CAPTCHA, no cadastro e no login; ver §15.
- **Limite de tentativas** de login e de envio de e-mails: o do Better Auth, somado ao nosso rate limit (§10).
- Mensagens que não revelam se uma conta existe (F-01, F-03, F-04).
- **Links dos e-mails de conta:** token de **uso único**, com validade de 1 hora, conferido **no servidor** pelas rotas do Better Auth (`/api/auth/*`). Funcionam em qualquer aparelho.
- **Cadastro, reenvio e recuperação só pelas Server Actions** (NBB-39, NBB-41): as rotas `/api/auth/sign-up/email`, `/api/auth/send-verification-email` e `/api/auth/request-password-reset` ficam **desligadas** na API pública (`disabledPaths`, respondem 404), para ninguém pular o anti-abuso (RN-46, §10) chamando a API direto.
- **Aviso de senha alterada:** todo e-mail de conta recebe um aviso quando a senha muda, com link para redefinir ("não fui eu").
- **Aviso de conta excluída** (NBB-82): depois da exclusão, a conta recebe um aviso com orientação para o caso de não ter sido a pessoa. Sai depois de apagar; se falhar, a exclusão vale e o erro só vai para o log.
- **Redefinir a senha encerra todas as sessões** da conta (`revokeSessionsOnPasswordReset`, NBB-41), inclusive a de quem a tenha invadido.
- A chave SMTP do Resend só tem permissão de envio e só para `orco.nbbrdev.com` (ADR-0016).
- **Google OAuth:** um cliente por ambiente (produção, staging e localhost), cada um só com o redirect do seu domínio (`/api/auth/callback/google`). Segredo de cada um só no `.env` do ambiente.
- **Vinculação Google ↔ conta por senha** só com o e-mail confirmado dos dois lados (padrão do Better Auth). Uma conta por senha ainda não confirmada **não** é vinculada: senão, quem cadastrasse o e-mail de outra pessoa antes dela ficaria com a conta quando ela entrasse com o Google (NBB-40).
- Erros do login com Google (e outros sem destino próprio) voltam ao `/entrar` com mensagem em pt-BR, nunca à página de erro padrão do Better Auth (`onAPIError.errorURL`).

## 2. Sessão

- Sessões do Better Auth guardadas no Postgres, com cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
- **Toda autorização parte da sessão validada no servidor**, a cada requisição que exige login (Server Components, Server Actions, Route Handlers). Nunca confiar em dados de sessão vindos do navegador sem validar.
  - Toda página e Server Action do `/app` chama o `requireSessionUser()` (`src/lib/auth/session.ts`), que manda para o `/entrar` sem sessão (NBB-41).
  - **Não** checar o login no layout: o Next não executa o layout de novo ao navegar entre páginas.
- Logout invalida a sessão no banco.

## 3. Autorização (RLS, ADR-0014)

- **RLS habilitada e forçada (`FORCE`) em 100% das tabelas do produto**, deny-by-default. Policies em [05-dados.md](05-dados.md).
- **Três roles:**
  - `orco_owner`: dona das tabelas; **só** nas migrations;
  - `app_auth`: **só** as tabelas de login;
  - `app_user`: **só** as tabelas do produto, com RLS.
- O app **nunca** se conecta como `orco_owner`, `postgres` ou qualquer role com `BYPASSRLS`.
- Toda policy de dono usa `user_id = app.current_user_id()` (em `profiles`, `id = app.current_user_id()`).
- **Permissão por coluna** quando a tabela tem colunas que só o sistema mexe: em `profiles`, a `app_user` não pode alterar o `id`, o contador de orçamentos nem as datas (NBB-42).
- Todo acesso a dados do produto passa por `withUserDb(userId, fn)`. Ela abre uma transação com `set_config('app.user_id', …, true)`, que vale **só nessa transação**. Fora dela, nenhuma linha é visível.
- `PUBLIC` não tem acesso a tabelas nem `execute` em funções; cada permissão é concedida à role certa.
- Transições de status e travas (RN-25) garantidas por trigger no banco, não só na UI.
- Todo PR que cria ou altera uma tabela inclui **teste de RLS contra um Postgres real**:
  - outro usuário não lê nem altera;
  - sem usuário na transação, nada é visível;
  - a `app_auth` não alcança as tabelas do produto.
- **Invariantes conferidos no CI** (NBB-57 S1-A, `tests/integration/security-invariants.test.ts`): toda tabela do `public` com RLS ENABLE + FORCE e ao menos uma policy; toda função do `app` com dono `orco_owner` e `search_path` vazio; nenhuma função executável por `PUBLIC`; as roles do app sem superusuário, `BYPASSRLS`, criação de roles/bancos ou de objetos em schemas; e as permissões exatas da `app_user` (tabelas, colunas alteráveis, funções, sem o IP dos eventos) e da `app_auth` (só o schema `auth`). Permissão nova precisa entrar no teste, no mesmo PR, para ser revisada.

## 4. Acesso público ao orçamento (ADR-0005/0014)

- Token: 32 bytes de `gen_random_bytes` (256 bits) em base64url. É inviável adivinhar, não é sequencial e não deriva do ID.
  - Gerado **pelo banco** (NBB-46, Q6-A): a função `app.generate_public_token()` usa a extensão `pgcrypto`, instalada num schema próprio (`extensions`) que o app não alcança. A `unaccent` da busca (NBB-48) fica no mesmo schema, usada só pela `app.normalize_search()`.
  - O trigger de criação sempre gera um token novo, mesmo que o app mande outro, e a `app_user` não pode alterá-lo depois. Regenerar o link (RN-36) será uma função própria, na M6.
- **Nada aponta para dados de outra conta:** as FKs de `quotes` e `quote_items` para clientes, orçamentos e catálogo são compostas com o `user_id`. Uma FK sozinha não respeita a RLS, porque o Postgres confere a referência sem filtrar por conta (NBB-46).
- A página `/p/[token]` e o PDF público chamam as funções `get_public_quote` / `respond_to_quote` (`SECURITY DEFINER`, donas `orco_owner`, `execute` para `app_user`) **somente do servidor**. O banco não tem porta pública, então o navegador nunca fala com ele.
- As funções retornam **apenas** os campos necessários à exibição, nunca IDs internos, `user_id` ou e-mail da conta. Sem nome no perfil, o cabeçalho usa o **e-mail de contato**, e sem ele, nenhum nome (RN-04, NBB-52 D3-B).
- A leitura (`get_public_quote`) **só lê**; a visualização é uma função separada (`register_quote_view`), chamada pela página só quando não é robô nem o dono logado. O PDF público nunca conta visualização (NBB-52 D2-A).
- O **IP** dos eventos não aparece em nenhuma tela, e a `app_user` não lê essa coluna; só o administrador, pelo DBeaver (NBB-52 D8-A). Depois de 12 meses, ele é apagado (RN-37).
- O PDF público (`/api/p/[token]/pdf`) responde com `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex`, e tem limite de 10 por minuto por IP (RN-39).
- IP e user agent vêm dos headers repassados pelo **Nginx** (`X-Forwarded-For`, `X-Real-IP`), lidos no servidor. O app só confia nesses headers porque só o Nginx o alcança (porta ligada a `127.0.0.1`).
- Respostas idênticas para token inválido, rascunho e excluído (RN-31), para não revelar se um token existe.
- `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex` na página pública, para o token não vazar nem ser indexado.

## 5. Validação de entrada

- Todo Server Action e Route Handler valida a entrada com **Zod no servidor**. A validação no client é só UX.
- Totais **sempre recalculados no servidor**; valores de total enviados pelo client são ignorados.
- Limites de tamanho em todo texto livre (Zod e `check` no banco).
- Nenhum HTML de usuário é renderizado como HTML: sem `dangerouslySetInnerHTML` com dado de usuário. Quebras de linha viram `white-space: pre-line`.

## 6. Criptografia

| Onde | Como |
|---|---|
| Em trânsito | TLS em tudo que sai da VPS: Nginx + Let's Encrypt; SMTP do Resend com TLS. Dentro da VPS, o app fala com o banco e o RustFS pela rede privada do Docker, sem sair da máquina. HSTS com `max-age=63072000; includeSubDomains; preload`. |
| Em repouso | Disco da VPS (proteção física do provedor). Backups manuais guardados só no computador do dono, sem criptografia (risco aceito em 2026-10-06, §14). Criptografia do disco da VPS: reavaliar na M7. |
| Senhas | Hash lento (scrypt/argon2) pelo Better Auth. |
| Tokens públicos | Aleatórios (CSPRNG), 256 bits. |
| Por coluna | **Não** no MVP: não guardamos dados de pagamento nem dados sensíveis (art. 5º, II, da LGPD). O CPF/CNPJ é opcional (minimização). Reavaliar se o escopo mudar. |

## 7. Headers HTTP (CSP no proxy; demais no `next.config`)

**CSP com nonce, no proxy** (`src/proxy.ts` + `src/lib/security/csp.ts`), porque muda a cada requisição:
- **Nonce:** 16 bytes aleatórios (`randomBytes`), novo a cada requisição. Vai nos headers da **requisição** (`x-nonce` e a CSP), de onde o Next extrai o nonce e o coloca nos próprios scripts, e na **resposta**, que o navegador aplica.
- **Diretivas:**
  - `default-src 'self'`;
  - `script-src 'self' 'nonce-…' 'strict-dynamic'`, sem nenhuma origem de terceiros e **nunca** `'unsafe-inline'`;
  - `style-src 'self' 'unsafe-inline'`;
  - `img-src 'self' data: blob:` (os logos vêm de uma rota do próprio app);
  - `font-src 'self'`;
  - `connect-src 'self'`;
  - `frame-src 'none'` (o app não incorpora páginas de outros sites);
  - `worker-src 'self'` e `manifest-src 'self'`;
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- **Só em desenvolvimento:** `'unsafe-eval'`, que o React usa para detalhar erros.
- **Só fora de desenvolvimento:** `upgrade-insecure-requests`. Em `http://localhost` e no celular pela rede local não há HTTPS, e a troca quebraria a página.
- **Por que `style-src 'unsafe-inline'`:** atributos `style="…"` (React, Radix/shadcn) não aceitam nonce, e bloqueá-los quebraria componentes. CSS injetado não executa código nem lê cookies: o risco é muito menor que o de script, que continua travado pelo nonce.
- O script inline do **next-themes** (evita piscar o tema) recebe o mesmo nonce: o `src/app/layout.tsx` lê `x-nonce` e passa na prop `nonce` do `ThemeProvider`.
- **Consequência aceita:** com nonce, **todas as páginas são renderizadas por requisição** (dinâmicas). O nonce não existe no build, e o layout lê `headers()`. Sem páginas estáticas nem cache de CDN para HTML.
- **O matcher do proxy não exclui prefetches** (a doc do Next sugere excluir): no staging, eles escapariam do Basic Auth.

**Headers fixos, no `next.config.ts`** (lista em `src/lib/security/headers.ts`), que vale também para arquivos estáticos e APIs:
- `Strict-Transport-Security` (ver §6).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin` (padrão) / `no-referrer` (em `/p/*`).
- `X-Robots-Tag: noindex, nofollow` em `/p/*`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.
- `Cross-Origin-Opener-Policy: same-origin` (NBB-57 S2): uma página de outro site aberta a partir do Orçô, ou que o abriu, não alcança a janela dele. O login com o Google é por redirecionamento, então não é afetado.
- `poweredByHeader: false`: sem `X-Powered-By: Next.js`.
- Verificação externa (securityheaders.com, nota A) no staging, quando ele estiver no ar (NBB-35).

## 8. CSRF

- Server Actions: o Next.js verifica `Origin` contra `Host`. Não desativar.
- Route Handlers com método diferente de GET verificam `Origin` explicitamente.
- Cookies `SameSite=Lax`.

## 9. Upload (logo)

- Tipos PNG, JPEG e WebP; **SVG proibido** (pode conter script). Tamanho de até 5 MB. A regra vale **no servidor** (e no client, só como UX). O redimensionamento no client (RN-05) é otimização, não controle de segurança.
- O servidor confere o tipo pelo **conteúdo** do arquivo, não só pela extensão ou pelo `Content-Type` enviado.
- Chave `{uuid}.{ext}` com UUID gerado pelo servidor, **sem o id da conta** (o endereço do logo é público e o §4 proíbe expor IDs internos); o perfil alterado é sempre o da sessão; o nome original é descartado ([05-dados.md](05-dados.md), ADR-0015, NBB-81).
- O navegador reduz a imagem antes de enviar (RN-05); o servidor **não** a refaz (decisão L2 da NBB-81, sem a biblioteca `sharp`). Ele só confere os primeiros bytes e o tamanho.
- Server Actions aceitam até 5 MB (`serverActions.bodySizeLimit`), o mesmo limite do Nginx (`client_max_body_size 5m`).
- O RustFS não tem porta pública. As chaves de acesso a ele ficam só no servidor.

## 10. Rate limit e anti-abuso (ADR-0004)

Revistos em 2026-10-04 (NBB-57 S4) e mantidos: ainda não há uso real para calibrar. Recalibrar depois do lançamento, com os logs.

| Alvo | Chave | Limite |
|---|---|---|
| `/p/[token]` (visualização) | IP | 60/min |
| Aprovar/recusar | IP + token | 5/min |
| PDF (dono) | user_id | 20/min |
| PDF (público) | IP | 10/min |
| Criação de orçamentos | user_id | ver RN-38 |
| Cadastro por e-mail | IP | 3/hora (RN-46) |
| Reenvio do e-mail de confirmação | IP | 3/hora (RN-46) |
| E-mails de cadastro (confirmação + reenvio) | global | 60/dia (RN-46); só o `.env` local e o CI aumentam, para os testes E2E (`SIGN_UP_EMAILS_PER_DAY`, NBB-54); a VPS não recebe a variável |
| Recuperação de senha | IP | 3/hora (NBB-41; fora do teto diário) |
| Login (tentativas) | IP | limite embutido do Better Auth |

A resposta ao exceder o limite é HTTP 429 com mensagem amigável.

## 10.1 Notificações, cron e service worker (ADR-0009)

- **Cron:** `/api/cron/lembretes` só executa com `Authorization: Bearer $CRON_SECRET`, enviado pelo agendamento na VPS. Sem o header correto, a resposta é 401. A comparação é em tempo constante.
  - **Como ficou** (NBB-62, 2026-10-04): a rota é `POST /api/cron/diario`. Sem a `CRON_SECRET` configurada, responde 503 (fechada, nunca aberta por esquecimento). Fica fora do Basic Auth do staging, porque tem a própria senha. O `daily.sh` manda a senha pela entrada padrão do `curl`, para ela não aparecer na lista de processos da VPS, e chama o app só pela porta local.
- **Push:** a `VAPID_PRIVATE_KEY` fica só no servidor. As assinaturas (`push_subscriptions`) ficam protegidas por RLS e são tratadas como dado pessoal: apagadas com a conta e quando expiram.
  - **Como ficou** (NBB-61, 2026-10-04): a app_user lê e apaga só as assinaturas da própria conta; gravar é pela função `app.save_push_subscription`, que passa a assinatura para a conta logada se o navegador trocou de conta. Na resposta do cliente, sem a sessão do freelancer, as assinaturas chegam pelo aviso da `respond_to_quote` (P3-A), e as vencidas (404/410) são apagadas pelo endereço exato (`app.delete_push_subscription`). O log de falha não leva o endereço da assinatura.
  - O service worker só abre endereços do próprio app (`/caminho`), nunca de outro domínio.
- **Conteúdo do push:** apenas número do orçamento, primeiro nome do cliente e o evento. Nada de valores, CPF/CNPJ ou dados de contato na notificação, porque ela aparece na tela bloqueada.
- **Service worker:** servido do próprio domínio (`/sw.js`, escopo `/`), sem cache de páginas autenticadas (sem modo offline) e sem importar scripts de terceiros. A CSP inclui `worker-src 'self'` e `manifest-src 'self'`.

## 10.2 Staging

- Protegido por **HTTP Basic Auth no proxy** quando `APP_ENV=staging`, exceto nas rotas públicas do orçamento (`/p/*`, `/api/p/*`) e nos arquivos do PWA (`src/lib/basic-auth.ts`). A comparação das credenciais é feita em **tempo constante** (hash SHA-256 + `timingSafeEqual`), para que o tempo de resposta não revele a senha.
- Sem credenciais configuradas, o staging responde **503**: fica fechado, nunca aberto por esquecimento.
- `X-Robots-Tag: noindex, nofollow` em todas as rotas do staging.
- Não há preview por PR ([08-infra-deploy.md](08-infra-deploy.md)): o acesso SSH à VPS fica nos environments `staging` (só `main`) e `production` (só tags `v*`), fora do alcance de qualquer PR.
- Staging e produção são **projetos Compose separados**, com redes e volumes próprios: o app de staging não alcança o banco de produção.
- Dados sempre fictícios; o banco de staging nunca recebe cópia de produção.

## 11. Segredos e repositório público

- **O repositório é público.** A segurança nunca depende de o código ser secreto.
- Segredos do app só nos arquivos `.env` **da VPS** (`/opt/orco/<ambiente>/.env`, legíveis só pelo usuário `deploy`) e no `.env.local` do desenvolvedor. O GitHub guarda só o acesso SSH de deploy. Nunca no código, em docs, seeds, fixtures ou **na imagem Docker**.
- `.env*` no `.gitignore`; `.env.example` e `deploy/env.example` com nomes e sem valores.
- Prefixo `NEXT_PUBLIC_` (embutido no build e visível no navegador) só para valores públicos por natureza: a versão do app. A chave pública VAPID também é pública, mas é lida na hora pelo servidor e passada à página do perfil (NBB-61 P2-A). Senhas de banco, segredo do Better Auth, chaves SMTP/RustFS/VAPID privadas e `CRON_SECRET` **nunca**.
- **VPS:** SSH só por chave (sem senha, sem root), firewall com só 22/80/443, atualizações de segurança automáticas; banco e RustFS sem porta publicada.
- Seeds e testes usam dados fictícios (`@example.com`, CPFs de teste gerados).
- GitHub: **secret scanning + push protection** ativos (ADR-0007).
- **Sem licença** (NBB-30, 2026-10-05): o código é público só para consulta, sem licença de cópia ou reutilização; o código, o nome Orçô e o logo pertencem ao mantenedor (dito também nos termos de uso).
- **`SECURITY.md`** na raiz: falhas de segurança são avisadas em particular, pelo e-mail do mantenedor, nunca por issue pública.

## 12. Dependências e código

- Lockfile (`package-lock.json`) commitado; CI com `npm ci` (instala exatamente o lockfile e falha se ele estiver desatualizado).
- Dependabot (npm, github-actions e imagens Docker) semanal; alertas e atualizações de segurança ativos. Imagens de terceiros (Postgres, RustFS, Node) com **versão fixa**.
- `npm audit --audit-level=high --omit=dev` no CI: só as dependências de produção, que rodam no servidor. Ferramentas de desenvolvimento (ex.: o CLI do shadcn, que fica em `devDependencies`) não travam o CI; os alertas delas chegam pelo Dependabot (decidido em 2026-10-02, depois do alerta do `braces` sem correção, NBB-42).
- **Scripts de instalação de dependências** (`preinstall`/`install`/`postinstall`) só rodam com aprovação explícita, registrada em `allowScripts` no `package.json` (npm 11). Padrão: **negar**, a menos que o pacote realmente precise do script. Cada aprovação é decidida no PR. Ex.: `unrs-resolver` negado (o binário nativo já vem pelas `optionalDependencies`).
- CodeQL `security-extended` em todo PR (bloqueante).
- Actions de terceiros fixadas por SHA; `permissions:` mínimas em cada workflow.

## 13. Logs e privacidade (LGPD)

- **Nunca logar** senhas, tokens públicos, cookies, headers de autorização, CPF/CNPJ, e-mails ou telefones.
- Bases legais: execução de contrato (dados da conta), legítimo interesse (IP do aceite como evidência e segurança).
- **Minimização no login com Google:** do perfil do Google, o Orçô guarda só o e-mail e o nome (coluna técnica). A foto é descartada, porque não é usada (NBB-40).
- Retenção: dados da conta até a exclusão (RN-06); IP de eventos por 12 meses (RN-37). Desde a NBB-30 (T4-A), a tarefa diária também apaga as janelas dos limites de uso com mais de 2 dias (as chaves têm IP) e as sessões de login expiradas (IP e navegador), pela função `app.purge_old_records()`.
- Direitos do titular: exclusão pela própria conta; demais pedidos pelo e-mail de contato da política de privacidade.
- Os dados dos clientes finais cadastrados pelo freelancer são tratados pelo Orçô como **operador**; o freelancer é o controlador. Isso consta nos termos.
- Política de privacidade e termos publicados antes do go-live (M7). ⚠️ PENDENTE: texto.
- **Como ficou** (NBB-30, 2026-10-04): `/termos` e `/privacidade`, públicas (fora do login e do Basic Auth do staging). Responsável: o mantenedor, pelo nome (T1-B). **Canal de contato** (revisto em 2026-10-05): o e-mail do mantenedor, `nbbr.dev@gmail.com`, nos dois textos (em vez do `privacidade@nbbrdev.com` planejado no T2-A). Pedidos do titular respondidos em até 15 dias. Suboperadores: Hostinger (servidor e DNS, no Brasil), Resend (e-mails, EUA: transferência internacional), Google, Apple e Mozilla (push; Google também no login). Retenção prometida: conta até a exclusão; IP do link 12 meses; sessões expiradas e IP dos limites de uso apagados diariamente (até 2 dias); registros de acesso do servidor até 14 dias. Aceite pela frase no cadastro, sem caixa de marcar e sem guardar a versão aceita (T5, T6). Texto redigido sem revisão jurídica.

## 14. Backups e continuidade

- **Sem backup automático** (decidido pelo usuário em 2026-09-30, NBB-75: projeto pequeno, simplicidade). O backup é **manual, pelo DBeaver, obrigatório antes de cada release a partir da primeira depois da `v1.0.0`** (que aplica migrations na produção). Até a `v1.0.0`, inclusive, a produção não tinha usuários reais (decisões do usuário em 2026-10-05). O primeiro backup da produção foi feito em 2026-10-06 (NBB-96). Passo a passo em `deploy/README.md`.
- **Acesso:** o Postgres de cada ambiente escuta só em `127.0.0.1` da VPS (5433 produção, 5434 staging), sem porta liberada no firewall. O DBeaver entra por **túnel SSH** com a chave de administração e usa o superusuário `postgres`.
- **Conteúdo:** só o banco (`pg_dump`, formato custom: schema e dados, incluindo `auth`). O `pg_dump` não leva as roles: na restauração, elas nascem pelo bootstrap (`init.sh`/`roles.sql`) antes do `pg_restore`. O RustFS (logos) fica fora: se a VPS for perdida, os logos são enviados de novo (risco aceito).
- **Guarda:** o arquivo contém dados pessoais reais. Fica só no computador do dono, nunca no repositório nem em nuvem, **sem criptografia** (decisão do usuário em 2026-10-06, NBB-77 R2-C; opções descartadas: BitLocker no disco do PC e cópia em nuvem criptografada).
- **Teste de restauração:** feito em 2026-10-06 com o primeiro backup da produção, no banco local (NBB-96). A parte técnica (donos, RLS, GRANTs, funções) já tinha sido testada em 2026-10-05 com um backup do banco local (NBB-58).
- **Riscos aceitos:** perda dos dados desde o último backup manual se a VPS for perdida entre duas releases; depende de o dono lembrar do backup (o passo 0 da release, `docs/06-regras-dev.md` §4.1); quem tiver acesso ao computador do dono lê os backups, que não são criptografados (NBB-77).
- Reforço opcional: snapshots da VPS no painel da Hostinger.

## 15. Auditoria de segurança (NBB-57, 2026-10-04)

Feita antes do lançamento (M7). Resultado:

| O que | Como foi conferido | Resultado |
|---|---|---|
| RLS e permissões do banco | Teste `security-invariants.test.ts`, que roda no CI a cada PR (§3) | As 8 tabelas com RLS ENABLE + FORCE e policies; todas as funções do `app` com dono `orco_owner` e `search_path` vazio; nenhuma função executável por `PUBLIC`; `app_user` e `app_auth` só com as permissões esperadas |
| Headers HTTP | [securityheaders.com](https://securityheaders.com) na produção | **A+** (HSTS com preload, CSP com nonce, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`). O `Cross-Origin-Opener-Policy` foi adicionado nesta auditoria (§7) |
| TLS | [SSL Labs](https://www.ssllabs.com/ssltest/) em `orco.nbbrdev.com` | **A+** (TLS 1.3, troca de chaves pós-quântica, HSTS longo) |
| Firewall da VPS | `ufw status verbose` | Entrada bloqueada por padrão; abertas só 22, 80 e 443 (IPv4 e IPv6). As portas publicadas pelo Docker ficam só em `127.0.0.1` (app 3000/3001, banco 5433/5434 para o túnel do DBeaver); o RustFS não publica porta. Fora do Nginx, nada é alcançável |
| Dependências e código | Dependabot e CodeQL no GitHub | Nenhum alerta aberto. O CI segue barrando dependências de produção com falha alta (`npm audit`) |

**Riscos aceitos, reavaliados (S3):**
- **Senhas vazadas (HaveIBeenPwned):** continua sem. A checagem (pelo prefixo do hash, sem mandar a senha) foi explicada e preterida; o mínimo de 8 caracteres e o limite de tentativas continuam valendo.
- **CAPTCHA:** continua sem, no cadastro (há limite por IP, honeypot e teto diário, RN-46) e no login (limite de tentativas do Better Auth).
- **Monitoramento de erros (Sentry):** fica fora. Os erros ficam nos logs do Docker na VPS (`orco <ambiente> logs app`, deploy/README.md), sem dados pessoais mandados a terceiros.

**Mantido como está:** `style-src 'unsafe-inline'` na CSP (S2): usado pelo Next e pelas bibliotecas de interface; os scripts continuam travados pelo nonce. Os limites de uso (§10) ficam como estão (S4).

## Checklist de segurança do PR

- [ ] Tabela nova/alterada tem RLS (`ENABLE` + `FORCE`) + teste de RLS contra Postgres real
- [ ] Acesso a dados do produto só via `withUserDb`, com o usuário da sessão validada no servidor
- [ ] O app não se conecta como `orco_owner`/superusuário; `app_auth` só nas tabelas de login
- [ ] Entrada validada com Zod no servidor
- [ ] Nenhum segredo, dado real ou PII em código, log, teste ou imagem Docker
- [ ] Sem `dangerouslySetInnerHTML` com dado de usuário
