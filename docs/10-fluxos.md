# 10 — Fluxos

> Status: **✅ todos os fluxos validados pelo usuário em 2026-09-27.** Fluxos novos entram como `⏳` até serem aprovados.
> Última atualização: 2026-09-27
>
> **Portão da M0:** o desenvolvimento (M1) só começa quando todos os fluxos estiverem `✅`. Cumprido.
>
> Cada fluxo tem um **orçamento de simplicidade**: o máximo de telas, toques e campos obrigatórios. Uma implementação que estoure esse orçamento é considerada bug de UX.

## Índice

| # | Fluxo | Ator | Status |
|---|---|---|---|
| F-01 | Cadastro com e-mail e senha | Freelancer | ✅ |
| F-02 | Entrar/cadastrar com Google | Freelancer | ✅ |
| F-03 | Entrar com e-mail e senha | Freelancer | ✅ |
| F-04 | Recuperar senha | Freelancer | ✅ |
| F-05 | **Primeiro orçamento (fluxo principal)** | Freelancer | ✅ |
| F-06 | Compartilhar orçamento (link / PDF) | Freelancer | ✅ |
| F-07 | Cliente aprova | Cliente final | ✅ |
| F-08 | Cliente recusa | Cliente final | ✅ |
| F-09 | Acompanhar orçamentos | Freelancer | ✅ |
| F-10 | Editar orçamento enviado | Freelancer | ✅ |
| F-11 | Expiração e prorrogação | Sistema / Freelancer | ✅ |
| F-12 | Duplicar orçamento | Freelancer | ✅ |
| F-13 | Excluir orçamento / regenerar link | Freelancer | ✅ |
| F-14 | Completar perfil | Freelancer | ✅ |
| F-15 | Gerenciar clientes | Freelancer | ✅ |
| F-16 | Gerenciar catálogo | Freelancer | ✅ |
| F-17 | Excluir conta | Freelancer | ✅ |
| F-18 | Ativar notificações push e instalar o app | Freelancer | ✅ |

---

## F-01 — Cadastro com e-mail e senha · ✅

**Orçamento de simplicidade:** 2 campos obrigatórios · 1 tela + 1 e-mail.

1. Landing `/` → **Começar grátis** → `/cadastro`.
2. Informa e-mail e senha (RN-03), com o requisito da senha visível enquanto digita. O Turnstile roda invisível.
3. **Criar conta** → a tela mostra "Enviamos um link para *email*. Abra para ativar sua conta." com botão **Reenviar**.
4. Abre o e-mail (remetente Orçô, domínio próprio) → clica no link → `/auth/confirm` (o servidor confere o código do link; funciona mesmo se o e-mail for aberto em outro aparelho) → já entra logado em `/app/orcamentos`, que está vazia e mostra o botão grande **Criar primeiro orçamento** (F-09).

**Erros:**
- E-mail já cadastrado: mensagem genérica "Se este e-mail puder ser usado, você receberá um link", para não revelar quais contas existem.
- Senha fraca: validação inline, antes do envio.
- Link expirado: página com botão **Reenviar link**.
- CAPTCHA falhou: "Não conseguimos verificar. Tente novamente."

## F-02 — Entrar/cadastrar com Google · ✅

**Orçamento:** 0 campos · 1 toque + tela do Google.

1. `/entrar` ou `/cadastro` → **Continuar com Google**.
2. Consentimento no Google → `/auth/callback`.
3. Sempre vai para `/app/orcamentos`. No primeiro acesso, a lista vazia mostra **Criar primeiro orçamento**, igual ao F-01.

**Erros:** o usuário cancelou no Google → volta a `/entrar` com "Login cancelado". Se o e-mail já tem conta por senha, o Better Auth vincula as identidades (e-mail verificado nos dois lados).

## F-03 — Entrar com e-mail e senha · ✅

**Orçamento:** 2 campos · 1 tela.

1. `/entrar` → e-mail + senha → **Entrar** → `/app/orcamentos`.

**Erros:** credenciais inválidas → "E-mail ou senha incorretos" (sem dizer qual). E-mail não confirmado → "Confirme seu e-mail" + **Reenviar**. Excesso de tentativas → "Muitas tentativas. Tente em alguns minutos."

A sessão persiste no navegador até o logout; não existe "lembrar de mim".

## F-04 — Recuperar senha · ✅

1. `/entrar` → **Esqueci minha senha** → `/recuperar-senha` → e-mail → **Enviar**.
2. A resposta é sempre "Se existir uma conta, enviamos um link".
3. Link do e-mail → `/auth/confirm` → `/redefinir-senha` → nova senha → **Salvar** → entra logado.
4. A conta recebe o e-mail **"Sua senha do Orçô foi alterada"**, com o botão "Não fui eu: redefinir senha". O mesmo aviso sai em qualquer troca de senha (segurança, 2026-09-28).

## F-05 — Primeiro orçamento (fluxo principal) · ✅

**Meta: < 2 minutos do cadastro ao link copiado.**
**Orçamento de simplicidade:** 1 tela (editor) · 2 campos obrigatórios (descrição e preço do item; a quantidade já vem 1) · cliente opcional · nenhum pré-cadastro necessário.

```mermaid
flowchart TD
    A0[Cadastro / login] --> A[Lista vazia<br/>'Criar primeiro orçamento']
    A --> B[Editor de orçamento<br/>rascunho Nº 0001 já criado]
    B --> C{Cliente? opcional}
    C -->|existe| C1[Seleciona da lista]
    C -->|novo| C2[Criar 'Fulano' inline<br/>demais dados opcionais]
    C -->|pular| D
    C1 --> D
    C2 --> D[Item: digita a descrição]
    D -->|no catálogo| D1[Seleciona: preço e unidade preenchidos]
    D -->|novo| D2[Preenche preço<br/>☐ salvar no catálogo]
    D1 --> E[Quantidade: padrão 1]
    D2 --> E
    E --> F{Mais itens?}
    F -->|sim| D
    F -->|não| G[Opcional: desconto, validade, observações]
    G --> H[Copiar link / Baixar PDF]
    H --> I[Status: enviado<br/>'Link copiado! Envie ao seu cliente']
```

**Layout do editor (celular):**
```
Orçamento Nº 0001        Salvo ✓

Cliente  [ Maria Silva      ]

Itens
  Logo           1 × 800,00
  Site           1 × 2.000,00
  + Adicionar item

▸ Mais opções (desconto, validade, pagamento, prazo, observações, anotações)

──────────────────────────────
Total R$ 2.800,00  [Visualizar] [Compartilhar]
```
- A tela mostra só cliente, itens e total. Desconto geral, validade, condições de pagamento, prazo de execução, observações e anotações internas ficam recolhidos em **Mais opções**, já preenchidos com os padrões do perfil (RN-44).
- Rodapé fixo com o total e as ações.

**Detalhes:**
- O editor abre com número, validade padrão (RN-19) e observações padrão do perfil já preenchidos.
- Item novo digitado no editor: a opção **☐ salvar no catálogo** vem **desmarcada**.
- Total, subtotal e desconto são recalculados a cada digitação (RN-15 a RN-18).
- Salvamento automático com indicador discreto "Salvo" (RN-21).
- Se faltar algo exigido pela RN-13 ao tentar compartilhar, o campo faltante é destacado com uma mensagem direta, ex.: "Informe o valor do item 2 para enviar".
- Na primeira vez, se o perfil estiver vazio, aparece uma dica **não bloqueante**: "Adicione seu nome e logo para o orçamento ficar com a sua cara →".
- Perto do botão de compartilhar, um atalho **Compartilhar no WhatsApp** abre `wa.me` com o link. Não é envio automático: é o próprio app do usuário que abre.

## F-06 — Compartilhar orçamento · ✅

**Orçamento:** 1 toque.

- **Visualizar** → abre a prévia do PDF na tela (modal/tela cheia no celular), exatamente como o cliente vai receber. **Não muda o status** (RN-22a). A prévia tem atalhos para Copiar link / Baixar PDF / WhatsApp.
- **Copiar link** → copia `https://orco.nbbrdev.com/p/<token>` e mostra "Link copiado".
- **Baixar PDF** → gera o PDF no servidor e baixa como `Orcamento-0001-Cliente.pdf`.
- **WhatsApp** → link *click-to-chat* com a mensagem "Olá! Segue o orçamento Nº 0001: <link>" já escrita. Quem envia é o próprio freelancer, pelo WhatsApp dele; **não há API nem envio pelo sistema**.
  - Se o cliente do orçamento tem telefone: `wa.me/55DDDNUMERO?text=…` abre direto a conversa com ele. O telefone é normalizado para só dígitos, com `55` acrescentado quando tiver 10–11 dígitos.
  - Sem telefone: `wa.me/?text=…` e o freelancer escolhe o contato.
  - No celular abre o app; no computador, o WhatsApp Web/Desktop.
- Em qualquer um dos três, se o orçamento for `rascunho` e cumprir a RN-13, passa a `enviado` (RN-22).
- No **primeiro** envio da conta, logo depois do feedback "Link copiado", aparece o convite de notificações push (F-18).

## F-07 — Cliente aprova · ✅

**Orçamento:** 0 campos obrigatórios · 2 toques (Aprovar → Confirmar).

```mermaid
sequenceDiagram
    actor C as Cliente final
    participant P as /p/[token]
    participant S as Servidor/Banco
    C->>P: abre o link
    P->>S: get_public_quote(token)
    S-->>P: dados do orçamento (campos mínimos)
    S-->>S: registra "visualizado" (1ª vez, RN-35)
    C->>P: Aprovar
    P-->>C: Confirmar aprovação? [Seu nome (opcional)]
    C->>P: Confirmar
    P->>S: respond_to_quote(token, aprovar, nome)
    S-->>S: valida status/validade, grava evento (RN-34)
    S-->>P: ok
    P-->>C: "Orçamento aprovado! Fulano foi avisado."
```

A página mostra: logo e nome do freelancer, número, data, validade, cliente (se houver), itens, totais, condições de pagamento e prazo de execução (se houver), observações, dados de pagamento, **Baixar PDF**, **Aprovar**, **Recusar**, e os contatos do freelancer (telefone, e-mail, site, Instagram, se houver).

```
[logo] Estúdio Fulano · (11) 9…  · @fulano
Orçamento Nº 0001 · emitido 27/09 · válido até 12/10
Para: Maria Silva
Logo ............ 1 × 800,00 ... 720,00 (−10%)
Site ............ 1 × 2.000,00 . 2.000,00
Subtotal 2.720,00 · Desconto −220,00 · TOTAL R$ 2.500,00
Condições: 50% entrada, 50% entrega · Prazo: 15 dias úteis
Observações · Pagamento: Pix chave…
[Baixar PDF]   [ Recusar ]  [ ✓ Aprovar ]
```

Depois de aprovar, a confirmação mostra o botão **Falar com Fulano no WhatsApp** (`wa.me/<telefone do perfil>`), **só se** o freelancer tiver telefone no perfil.

**Erros:**
- Token inválido, rascunho ou excluído: página genérica "Orçamento não encontrado" (RN-31).
- Orçamento expirado: sem botões, com "Este orçamento venceu em dd/mm. Fale com *freelancer* para renovar."
- Orçamento já respondido: mostra o resultado e a data.
- Limite de requisições: "Muitas tentativas, aguarde um instante."

> "Fulano foi avisado": o freelancer recebe e-mail (RN-40) e/ou push (RN-45) e vê o destaque "novo" na lista.

## F-08 — Cliente recusa · ✅

Igual ao F-07, mas com **Recusar** → "Quer dizer o motivo?" (opcional), com chips rápidos **Preço · Prazo · Desisti · Outro** e/ou texto livre → **Confirmar recusa** → "Orçamento recusado. Fulano foi avisado." O e-mail ao freelancer (RN-40) inclui o motivo.

## F-09 — Acompanhar orçamentos · ✅

- `/app/orcamentos` é a tela inicial: cartões com número, cliente, total, status (com cor), "visualizado em…" e o selo **novo** para respostas ainda não vistas.
- Ordem padrão: **última atividade** (edição ou resposta mais recente primeiro).
- Sem resumo ou contadores no topo (relatórios estão fora do MVP).
- Filtros por status em abas: Todos · Rascunhos · Enviados · Aprovados · Recusados · Expirados.
- Busca por cliente ou número.
- Estado vazio: "Você ainda não tem orçamentos" + botão grande **Criar primeiro orçamento**.

## F-10 — Editar orçamento enviado · ✅

- Mesmo editor. Um aviso discreto informa: "Este orçamento já foi enviado. O cliente verá as alterações ao abrir o link."
- Cada alteração salva incrementa a versão (RN-24).
- Depois da primeira alteração salva, o aviso muda para **"Orçamento atualizado · [Avisar cliente no WhatsApp]"**. O botão abre o WhatsApp (mesma regra de telefone do F-06) com "Olá! Atualizei o orçamento Nº 0001: <link>". Não muda o status, que já é enviado.
- Aprovados e recusados abrem em modo leitura com o botão **Duplicar para editar** (RN-25). Só as **anotações internas** continuam editáveis (RN-20a).

## F-11 — Expiração e prorrogação · ✅

- O status `expirado` é calculado automaticamente (RN-26).
- No orçamento expirado, o botão **Prorrogar validade** abre um seletor de data com a sugestão **hoje + validade padrão do perfil** (ex.: +15 dias). Ao salvar, o orçamento volta a `enviado` (RN-27) e o mesmo link continua valendo.

## F-12 — Duplicar orçamento · ✅

- Menu do orçamento → **Duplicar** → abre o editor com um novo rascunho (RN-28).

## F-13 — Excluir orçamento / regenerar link · ✅

- **Excluir**: menu → confirmação "Excluir o orçamento Nº 0001? O link deixará de funcionar." (RN-29).
- **Gerar novo link**: menu → confirmação "O link atual deixará de funcionar." → novo token (RN-36).

## F-14 — Completar perfil · ✅

`/app/perfil` é uma página única com seções:
```
[Prévia do cabeçalho do orçamento]
Sua marca ........ nome de exibição, nome comercial, logo (RN-05)
Contato .......... telefone, e-mail, site, Instagram, CPF/CNPJ
Pagamento ........ dados de pagamento, ex.: Pix (RN-04)
Padrões .......... validade (dias), observações, condições de pagamento, prazo de execução
Aparência ........ Tema: [Automático | Claro | Escuro] (padrão Automático; salvo neste aparelho, RNF-16)
Notificações ..... ☑ Notificações por e-mail (respostas e lembretes, RN-41)
                   ☐ Notificações push neste aparelho (RN-45)
                   [Instalar o Orçô no celular] (quando o navegador permitir)
Conta ............ sair · excluir minha conta (F-17)
Rodapé ........... "Orçô v0.4.0" · link "Novidades" (notas da versão no GitHub Releases)
```
- Tudo opcional, salvo automaticamente.

## F-15 — Gerenciar clientes · ✅

- Lista com busca. **Novo cliente** abre um painel lateral (bottom sheet no celular): só o nome é obrigatório (RN-07).
- Tocar num cliente abre a edição e a lista de orçamentos dele, com atalho **Novo orçamento para este cliente**.
- Ao editar um cliente usado em rascunhos, aparece a pergunta "Atualizar também os N rascunhos deste cliente?" (RN-20).
- Excluir pede confirmação e só é permitido se o cliente não tiver orçamentos. Caso tenha, a mensagem é "Este cliente tem N orçamentos. Exclua-os antes de excluir o cliente." (RN-09).

## F-16 — Gerenciar catálogo · ✅

- Lista com busca. **Novo item**: nome (obrigatório), preço e unidade (opcionais) (RN-10).
- Excluir não afeta orçamentos. Ao editar um item usado em rascunhos, aparece a pergunta "Atualizar também os N rascunhos que usam este item?" (RN-11).
- Estado vazio: "Itens que você usa sempre ficam aqui. Você também pode salvá-los direto do orçamento."

## F-17 — Excluir conta · ✅

- `/app/perfil` → seção **Conta** → **Excluir minha conta** → explicação do que será apagado (RN-06) → digitar "EXCLUIR" → confirmar → a sessão é encerrada e a pessoa vê a landing com "Sua conta foi excluída".

## F-18 — Ativar notificações push e instalar o app · ✅

**Orçamento:** 1 toque (+ diálogo do sistema). Nunca bloqueia nada.

**Convite de push (uma única vez, RN-45):**
1. Logo após o **1º orçamento enviado** da conta (F-06), aparece um cartão: *"Quer ser avisado quando o cliente responder?"* com **[Ativar notificações]** e **[Agora não]**.
2. **Ativar** → diálogo nativo do navegador → se permitido, a assinatura do aparelho é salva e aparece a confirmação "Pronto! Você será avisado neste aparelho."
3. **Agora não** ou permissão negada → o convite não aparece mais (`push_prompted_at`). Dá para ativar depois no perfil (F-14).
4. **iPhone sem o app instalado:** em vez de pedir permissão (não funcionaria), o cartão explica: *"No iPhone, adicione o Orçô à tela inicial para receber notificações"*, com instruções curtas (Compartilhar → Adicionar à Tela de Início).

**Instalar o app (PWA):**
- Android/desktop: quando o navegador oferece a instalação, o perfil mostra **Instalar o Orçô**; o banner nativo do navegador também funciona.
- iPhone: instrução "Compartilhar → Adicionar à Tela de Início" no perfil.

**Notificações recebidas (exemplos):**
- "✅ Maria aprovou o orçamento Nº 0012", "❌ Maria recusou o orçamento Nº 0012 · Motivo: Preço"
- "👀 Maria abriu o orçamento Nº 0012"
- "⏰ O orçamento Nº 0012 vence amanhã e ainda não foi respondido"
- Tocar na notificação abre o orçamento no app.
