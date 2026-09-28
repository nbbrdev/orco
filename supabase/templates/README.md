# Templates de e-mail do Auth (pt-BR)

E-mails de conta enviados pelo **Supabase Auth**: cadastro, recuperação de senha, troca de e-mail, link de
acesso e aviso de senha alterada. Estes arquivos são a **fonte da verdade** (docs/08-infra-deploy.md,
seção Resend).

- **Local:** o `supabase/config.toml` aponta para estes arquivos. Os e-mails caem no **Mailpit**
  (http://127.0.0.1:54324) e nada sai para a internet. Depois de editar, reinicie: `npm run db:stop`
  e `npm run db:start`.
- **Staging e produção:** o conteúdo é **colado no painel** de cada projeto (checklist abaixo). Não usamos
  `supabase config push` porque ele exige o Access Token da conta, que fica fora do GitHub.

## Templates

| Arquivo                              | Painel (Authentication → Emails)       | Assunto                            | Link                                                     |
| ------------------------------------ | -------------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| `confirmation.html`                  | Confirm signup                         | Confirme seu e-mail no Orçô        | `/auth/confirm?…&type=email&next=/app/orcamentos`        |
| `recovery.html`                      | Reset password                         | Redefina sua senha do Orçô         | `/auth/confirm?…&type=recovery&next=/redefinir-senha`    |
| `email_change.html`                  | Change email address                   | Confirme a troca de e-mail no Orçô | `/auth/confirm?…&type=email_change&next=/app/orcamentos` |
| `magic_link.html`                    | Magic link                             | Seu link de acesso ao Orçô         | `/auth/confirm?…&type=email&next=/app/orcamentos`        |
| `password_changed_notification.html` | Password changed (notificação, ligada) | Sua senha do Orçô foi alterada     | `/recuperar-senha`                                       |

- **Links:** todos usam `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`. O **servidor**
  confere o código (`verifyOtp`), então o link funciona em qualquer aparelho. O `ConfirmationURL`
  padrão (PKCE) falharia quando a pessoa se cadastra no PC e abre o e-mail no celular.
- **Variáveis usadas:** `{{ .SiteURL }}`, `{{ .TokenHash }}`, `{{ .Email }}`, `{{ .NewEmail }}`
  (só na troca de e-mail).
- **Troca de e-mail e link de acesso** não têm tela no Orçô, mas a API pública do Auth aceita esses
  pedidos. Por isso também estão em pt-BR.
- **Layout:**
  - HTML com estilos inline e sem imagens (muitos clientes de e-mail bloqueiam imagens);
  - cores do doc 12 (primária `#0F766E`);
  - rodapé "Esta caixa não recebe respostas".

## Checklist do painel (fazer em `orco-staging` e em `orco-prod`)

1. **Resend → API Keys → Create:** nome `supabase-smtp`, permissão **Sending access**, domínio
   `orco.nbbrdev.com`. Uma chave por projeto, se preferir revogar separadamente.
2. **Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP:**
   - Sender email: `nao-responda@orco.nbbrdev.com`
   - Sender name: `Orçô`
   - Host: `smtp.resend.com` · Port: `465`
   - Username: `resend` · Password: a API key do passo 1
3. **Authentication → Emails → Templates:** para cada linha da tabela, colar o **assunto** e o **HTML**
   do arquivo. Ativar a notificação **Password changed**.
4. **Authentication → Rate Limits:** ajustar o limite de e-mails por hora (o padrão com SMTP próprio é
   baixo). Referência do Resend Free: 100 por dia.
5. **Authentication → URL Configuration:** o Site URL precisa ser o do ambiente
   (`https://staging.orco.nbbrdev.com` ou `https://orco.nbbrdev.com`), porque os links usam
   `{{ .SiteURL }}`.
6. Testar: criar uma conta de teste no ambiente e conferir o e-mail recebido.

Mudou um template? Atualize o arquivo aqui **e** cole de novo nos dois painéis, no mesmo PR ou sessão.
