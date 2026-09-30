# ADR-0013 — Autenticação com Better Auth

- **Status:** aceito (decidido pelo usuário em 2026-09-29)
- **Data:** 2026-09-29
- **Substitui:** ADR-0002 na parte do provedor (Supabase Auth). Continuam valendo as regras de produto do ADR-0002: e-mail + senha com confirmação, Google, senha mínima de 8 sem exigência de tipos, sem magic link nem MFA. O Turnstile foi removido em 2026-09-29 (NBB-70): ver RN-46.

## Contexto
Sem Supabase (ADR-0012), o Orçô precisa de um componente de autenticação próprio. Autenticação é a área em que erros pequenos viram falhas graves:
- sessões;
- tokens de confirmação e recuperação;
- ataques de temporização e de força bruta.

## Decisão
- **Better Auth**, biblioteca TypeScript que roda **dentro do app**, com os dados no **nosso Postgres** (via Drizzle, ADR-0014):
  - e-mail + senha, com confirmação de e-mail obrigatória (RN-02) e recuperação de senha;
  - **Google OAuth**, com redirect para o nosso domínio (ex.: `https://orco.nbbrdev.com/api/auth/callback/google`);
  - **hash de senha** forte e lento (scrypt, padrão da biblioteca, ou argon2). O app nunca guarda nem loga a senha em texto;
  - **sessões** no banco, com cookie `HttpOnly`, `Secure` e `SameSite=Lax`. A validação acontece **sempre no servidor**, a cada requisição que exige login;
  - **limite de tentativas** de login e de envio de e-mails, da própria biblioteca, somado ao nosso rate limit (ADR-0004).
- **Tabelas de login** (usuários, contas, sessões, verificações): acessadas **só pela role `app_auth`** (ADR-0014). As tabelas do produto referenciam o usuário pelo `id`.
- **Links dos e-mails de conta** (confirmação, recuperação, troca de e-mail): token de **uso único**, com validade de 1 hora, conferido no servidor. Funcionam em qualquer aparelho.
- **Aviso de senha alterada** por e-mail (doc 02), enviado pelo nosso módulo de e-mail (ADR-0016).
- **Anti-abuso do cadastro** conferido na Server Action antes de criar a conta: limite por IP, honeypot e teto diário de e-mails (RN-46). Substituiu o Turnstile em 2026-09-29 (NBB-70).
- Implementado na **M2**, junto das telas (NBB-39/40/41).

## Alternativas descartadas
- **Auth.js (NextAuth):** a própria documentação desencoraja login com e-mail e senha. Confirmação e recuperação teriam de ser escritas à mão.
- **Implementação própria:** risco alto de falhas sutis num produto público.

## Consequências
- Não há mais `service_role`, `getClaims()` nem `getSession()` do Supabase. A regra passa a ser "**autorização sempre a partir da sessão validada no servidor**" (doc 07 §2).
- A política de senha (mínimo 8) é aplicada pelo Zod no servidor e na configuração do Better Auth.
- Risco aceito (herdado do ADR-0002): senhas fracas são permitidas e não há checagem de senhas vazadas no MVP. Reavaliar na M7.
