# 07 — Segurança

> Status: rascunho para validação · Última atualização: 2026-09-27
>
> As regras deste documento são **obrigatórias**. Um PR que viole qualquer uma delas não é aprovado.

## 1. Senhas e autenticação

- **Senhas nunca tocam nosso código nem nossas tabelas.** O Supabase Auth (GoTrue) faz o hash com **bcrypt** e guarda no schema `auth`. É proibido criar tabela de senha, fazer hash próprio ou logar senhas.
- Métodos: e-mail + senha e Google OAuth (ADR-0002).
- Confirmação de e-mail obrigatória para cadastro por senha (RN-02).
- Política de senha configurada no Supabase: mínimo de 8 caracteres, sem exigência de tipos (RN-03). Risco aceito, registrado no ADR-0002.
- Proteção contra senhas vazadas (HaveIBeenPwned): **não** no MVP (recurso de plano pago). Risco aceito no ADR-0002.
- **CAPTCHA** Cloudflare Turnstile **somente no cadastro**. Como a opção nativa do Supabase Auth vale para todos os endpoints de auth, ela fica **desligada**: a Server Action de cadastro valida o token no endpoint `siteverify` da Cloudflare **antes** de chamar `supabase.auth.signUp`. Se houver abuso, estender a login e recuperação (ou ligar a opção nativa).
- Rate limit de Auth nativo do Supabase (tentativas de login, envio de e-mails), revisado no painel.
- Mensagens que não revelam se uma conta existe (F-01, F-03, F-04).
- Redirect URLs do Auth restritas ao domínio de cada ambiente: produção no `orco-prod`; staging e `localhost` no `orco-staging`.

## 2. Sessão

- Cookies gerenciados por `@supabase/ssr`: `HttpOnly`, `Secure`, `SameSite=Lax`.
- O proxy (`src/proxy.ts`, antigo "middleware" até o Next 15) renova a sessão a cada requisição.
- **No servidor, a autorização usa sempre `supabase.auth.getUser()` ou `getClaims()`**, que validam o JWT. **Nunca** `getSession()`, que lê o cookie sem validar.
- Logout invalida a sessão no Supabase (`signOut`).

## 3. Autorização (RLS)

- **RLS habilitada em 100% das tabelas**, deny-by-default. Policies em [05-dados.md](05-dados.md).
- Toda policy de dono usa `user_id = (select auth.uid())`.
- `anon` não tem `select/insert/update/delete` em nenhuma tabela, nem `execute` em nenhuma função.
- Transições de status e travas (RN-25) garantidas por trigger no banco, não só na UI.
- Todo PR que cria ou altera uma tabela inclui teste de RLS: outro usuário não lê nem altera, e `anon` não acessa.

## 4. Acesso público ao orçamento (ADR-0005)

- Token: 32 bytes de `gen_random_bytes` (256 bits) em base64url. É inviável adivinhar, não é sequencial e não deriva do ID.
- A página `/p/[token]` e o PDF público chamam as RPCs `get_public_quote` / `respond_to_quote` **somente do servidor**, usando um client `service_role` isolado em `src/lib/supabase/admin.ts` (com `import 'server-only'`).
- Esse módulo admin só pode ser importado por: página pública, route handler do PDF público e exclusão de conta. A regra é garantida por lint (`no-restricted-imports`).
- As RPCs retornam **apenas** os campos necessários à exibição, nunca IDs internos, `user_id` ou e-mail da conta.
- IP e user agent vêm dos headers da Vercel (`x-forwarded-for`, `x-real-ip`), lidos no servidor.
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
| Em trânsito | TLS em tudo (Vercel e Supabase). HSTS com `max-age=63072000; includeSubDomains; preload`. |
| Em repouso | Criptografia de disco AES-256 do Supabase (banco, backups, storage). |
| Senhas | bcrypt pelo Supabase Auth. |
| Tokens públicos | Aleatórios (CSPRNG), 256 bits. |
| Por coluna | **Não** no MVP: não guardamos dados de pagamento nem dados sensíveis (art. 5º, II, da LGPD). O CPF/CNPJ é opcional (minimização). Reavaliar se o escopo mudar. |

## 7. Headers HTTP (CSP no proxy; demais no `next.config`)

**CSP com nonce, no proxy** (`src/proxy.ts` + `src/lib/security/csp.ts`), porque muda a cada requisição:
- **Nonce:** 16 bytes aleatórios (`randomBytes`), novo a cada requisição. Vai nos headers da **requisição** (`x-nonce` e a CSP), de onde o Next extrai o nonce e o coloca nos próprios scripts, e na **resposta**, que o navegador aplica.
- **Diretivas:**
  - `default-src 'self'`;
  - `script-src 'self' 'nonce-…' 'strict-dynamic'` + Turnstile (`https://challenges.cloudflare.com`), **nunca** `'unsafe-inline'`;
  - `style-src 'self' 'unsafe-inline'`;
  - `img-src 'self' data: blob: <supabase>`;
  - `font-src 'self'`;
  - `connect-src 'self' <supabase>`;
  - `frame-src` só Turnstile;
  - `worker-src 'self'` e `manifest-src 'self'`;
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- `<supabase>` é a origem de `NEXT_PUBLIC_SUPABASE_URL`.
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
- `poweredByHeader: false`: sem `X-Powered-By: Next.js`.
- Verificação externa (securityheaders.com, nota A) no staging, quando ele estiver no ar (NBB-35).

## 8. CSRF

- Server Actions: o Next.js verifica `Origin` contra `Host`. Não desativar.
- Route Handlers com método diferente de GET verificam `Origin` explicitamente.
- Cookies `SameSite=Lax`.

## 9. Upload (logo)

- Tipos PNG, JPEG e WebP; **SVG proibido** (pode conter script). Tamanho de até 5 MB. A regra vale no bucket (servidor) e no client. O redimensionamento no client (RN-05) é otimização, não controle de segurança: o bucket valida tipo e tamanho de qualquer forma.
- Caminho com UUID gerado pelo servidor; o nome original do arquivo é descartado.
- Policies de Storage por pasta `{user_id}/` (ver [05-dados.md](05-dados.md)).

## 10. Rate limit e anti-abuso (ADR-0004)

| Alvo | Chave | Limite inicial ⚠️ a calibrar |
|---|---|---|
| `/p/[token]` (visualização) | IP | 60/min |
| Aprovar/recusar | IP + token | 5/min |
| PDF (dono) | user_id | 20/min |
| PDF (público) | IP | 10/min |
| Criação de orçamentos | user_id | ver RN-38 |

A resposta ao exceder o limite é HTTP 429 com mensagem amigável.

## 10.1 Notificações, cron e service worker (ADR-0009)

- **Cron:** `/api/cron/lembretes` só executa com `Authorization: Bearer $CRON_SECRET` (a Vercel envia esse header automaticamente). Sem o header correto, a resposta é 401.
- **Push:** a `VAPID_PRIVATE_KEY` fica só no servidor. As assinaturas (`push_subscriptions`) ficam protegidas por RLS e são tratadas como dado pessoal: apagadas com a conta e quando expiram.
- **Conteúdo do push:** apenas número do orçamento, primeiro nome do cliente e o evento. Nada de valores, CPF/CNPJ ou dados de contato na notificação, porque ela aparece na tela bloqueada.
- **Service worker:** servido do próprio domínio (`/sw.js`, escopo `/`), sem cache de páginas autenticadas (sem modo offline) e sem importar scripts de terceiros. A CSP inclui `worker-src 'self'` e `manifest-src 'self'`.

## 10.2 Staging

- Protegido por **HTTP Basic Auth no proxy** quando `APP_ENV=staging`, exceto nas rotas públicas do orçamento (`/p/*`, `/api/p/*`) e nos arquivos do PWA (`src/lib/basic-auth.ts`). A comparação das credenciais é feita em **tempo constante** (hash SHA-256 + `timingSafeEqual`), para que o tempo de resposta não revele a senha.
- Sem credenciais configuradas, o staging responde **503**: fica fechado, nunca aberto por esquecimento.
- `X-Robots-Tag: noindex, nofollow` em todas as rotas do staging.
- Não há preview por PR ([08-infra-deploy.md](08-infra-deploy.md)): o token da Vercel e os segredos do banco ficam nos environments `staging` (só `main`) e `production` (só tags `v*`), fora do alcance de qualquer PR.
- Dados sempre fictícios; o banco `orco-staging` nunca recebe cópia de produção.

## 11. Segredos e repositório público

- **O repositório é público.** A segurança nunca depende de o código ser secreto.
- Segredos só em env vars da Vercel, secrets do GitHub Actions e painel do Supabase. Nunca no código, em docs, seeds ou fixtures.
- `.env*` no `.gitignore`; `.env.example` com nomes e sem valores.
- Apenas `NEXT_PUBLIC_SUPABASE_URL` e a chave publishable/anon podem ter prefixo `NEXT_PUBLIC_`. A `SUPABASE_SERVICE_ROLE_KEY` **nunca**.
- Seeds e testes usam dados fictícios (`@example.com`, CPFs de teste gerados).
- GitHub: **secret scanning + push protection** ativos (ADR-0007).

## 12. Dependências e código

- Lockfile (`package-lock.json`) commitado; CI com `npm ci` (instala exatamente o lockfile e falha se ele estiver desatualizado).
- Dependabot (npm + github-actions) semanal; alertas e atualizações de segurança ativos.
- `npm audit --audit-level=high` no CI.
- **Scripts de instalação de dependências** (`preinstall`/`install`/`postinstall`) só rodam com aprovação explícita, registrada em `allowScripts` no `package.json` (npm 11). Padrão: **negar**, a menos que o pacote realmente precise do script. Cada aprovação é decidida no PR. Ex.: `unrs-resolver` negado (o binário nativo já vem pelas `optionalDependencies`).
- CodeQL `security-extended` em todo PR (bloqueante).
- Actions de terceiros fixadas por SHA; `permissions:` mínimas em cada workflow.

## 13. Logs e privacidade (LGPD)

- **Nunca logar** senhas, tokens públicos, cookies, headers de autorização, CPF/CNPJ, e-mails ou telefones.
- Bases legais: execução de contrato (dados da conta), legítimo interesse (IP do aceite como evidência e segurança).
- Retenção: dados da conta até a exclusão (RN-06); IP de eventos por 12 meses (RN-37).
- Direitos do titular: exclusão pela própria conta; demais pedidos pelo e-mail de contato da política de privacidade.
- Os dados dos clientes finais cadastrados pelo freelancer são tratados pelo Orçô como **operador**; o freelancer é o controlador. Isso consta nos termos.
- Política de privacidade e termos publicados antes do go-live (M7). ⚠️ PENDENTE: texto.

## 14. Backups e continuidade

- O plano Free do Supabase não inclui backups restauráveis. O workflow `backup.yml` (diário) gera um dump **só do banco de produção** (`supabase db dump`: roles, schema e dados, incluindo o schema `auth`), via Session Pooler (IPv4). Os logos do Storage não entram: o usuário pode reenviá-los.
- O dump é **criptografado com `age`** usando uma **chave pública** (secret `BACKUP_AGE_PUBLIC_KEY`). A **chave privada nunca vai para o GitHub**: fica só com o dono do projeto, num gerenciador de senhas. Mesmo que o artifact seja baixado ou os secrets vazem, o backup permanece ilegível.
- **Destino:** artifact do GitHub Actions com **retenção de 30 dias**. Em repo público, qualquer usuário logado pode baixar o arquivo, e é por isso que a criptografia é obrigatória. Risco aceito: os backups ficam vinculados ao repositório.
- **Restauração:** baixar o artifact → `age -d -i <chave-privada>` → aplicar roles, schema e dados em um projeto novo (procedimento documentado em `docs/` na M7, com um **teste de restauração** antes do go-live).
- Projetos Free pausam após 7 dias sem atividade: monitorar, ou manter atividade mínima pelo mesmo workflow.

## Checklist de segurança do PR

- [ ] Tabela nova/alterada tem RLS + teste de RLS
- [ ] Entrada validada com Zod no servidor
- [ ] Nenhum segredo, dado real ou PII em código, log ou teste
- [ ] Nenhum uso de `getSession()` para autorização
- [ ] Nenhuma importação de `lib/supabase/admin` fora dos pontos permitidos
- [ ] Sem `dangerouslySetInnerHTML` com dado de usuário
