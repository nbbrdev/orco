# 02 — Escopo e delimitações

> Status: **✅ validado pelo usuário em 2026-09-27** · Última atualização: 2026-09-27
>
> Este é o documento mais importante do projeto. **Nada é implementado se não estiver em "Dentro do MVP".** Mudanças aqui exigem atualização do Linear Doc "Escopo" na mesma sessão.

## O que o Orçô É

Uma ferramenta web para **um freelancer** criar, enviar e acompanhar **orçamentos** para seus clientes, com aprovação online pelo cliente.

## O que o Orçô NÃO É (delimitações)

- **Não é ERP nem sistema financeiro:** não controla contas a pagar/receber, fluxo de caixa, estoque.
- **Não é emissor fiscal:** não emite nota fiscal, recibo fiscal nem calcula impostos.
- **Não é contrato nem assinatura digital:** o aceite registra data, hora e IP como **evidência simples**, sem validade jurídica de assinatura eletrônica (ICP-Brasil ou similar).
- **Não é meio de pagamento:** não cobra, não gera boleto/Pix, não parcela.
- **Não é CRM:** cadastro de clientes existe só para reaproveitar dados em orçamentos; não há funil, tarefas, histórico de contato.
- **Não é ferramenta de equipe:** uma conta = uma pessoa.
- **Não é canal de envio:** o Orçô não envia e-mail/WhatsApp **ao cliente final**; o freelancer copia o link ou baixa o PDF e envia por onde quiser. (O Orçô só notifica **o freelancer**: e-mails de conta, notificações por e-mail e push.)

## Dentro do MVP

### Conta
- Cadastro e login com **e-mail + senha** (confirmação de e-mail obrigatória) e **Google**.
- Recuperação de senha por e-mail.
- Aviso por e-mail sempre que a senha da conta é alterada (segurança; incluído em 2026-09-28, NBB-37).
- Proteção do cadastro contra robôs, sem CAPTCHA e sem passo extra: limite por IP, campo "isca" invisível e teto diário de e-mails (RN-46; decidido em 2026-09-29, no lugar do Cloudflare Turnstile).
- Exclusão da própria conta (apaga todos os dados).
- Aviso por e-mail quando a conta é excluída (segurança; incluído em 2026-10-03, NBB-82).

### Perfil do freelancer (opcional, completável a qualquer momento)
- Nome de exibição, nome comercial, logo, telefone, e-mail de contato, CPF/CNPJ, site, Instagram e dados de pagamento (texto informativo, ex.: chave Pix).
- Padrões para novos orçamentos: validade em dias, observações, condições de pagamento e prazo de execução.

### Clientes
- Criar, editar, listar, buscar e excluir clientes (nome, e-mail, telefone, CPF/CNPJ, endereço, observações internas). Cliente com orçamentos não pode ser excluído.
- Criação **inline** a partir do editor de orçamento.

### Catálogo de itens
- Criar, editar, listar, buscar e excluir itens (produto ou serviço) com preço e unidade opcionais; ao editar, opção de atualizar os rascunhos que usam o item.
- Autocompletar do catálogo no editor; opção de salvar um item novo no catálogo a partir do editor.

### Orçamentos
- Criar, editar, listar (com filtro por status), buscar e excluir orçamentos.
- Itens com descrição, quantidade, unidade, valor unitário e desconto por item (% ou R$, opcional); desconto geral (% ou R$); validade; **condições de pagamento**; **prazo de execução**; observações.
- **Reordenar os itens** arrastando (incluído em 2026-10-03, NBB-86).
- Numeração sequencial automática por usuário.
- Salvamento automático.
- Status: `rascunho → enviado → aprovado | recusado | expirado` (ver [09-regras-negocio.md](09-regras-negocio.md)).
- Cópia (snapshot) dos dados do cliente e dos itens no orçamento, com opção de atualizar rascunhos quando o cliente ou o item muda.
- Anotações internas do orçamento (privadas, editáveis em qualquer status).
- Duplicar orçamento.
- Indicador "cliente visualizou".

### Notificações ao freelancer
- **E-mail** quando o cliente aprova ou recusa e **lembrete** 1 dia antes de um orçamento enviado vencer sem resposta. Um único botão no perfil liga/desliga os e-mails.
- **Notificação push** (Web Push, no aparelho): resposta do cliente, lembrete de vencimento e "cliente visualizou". A permissão é pedida após o 1º orçamento enviado e pode ser ativada ou desativada por aparelho.

### Compartilhamento
- **PDF** com a marca do freelancer (logo e dados do perfil), gerado no servidor.
- **Link público** não-adivinhável, sem login para o cliente, com botões **Aprovar** e **Recusar** (motivo opcional).
- Registro de visualização, aprovação e recusa (data, hora, IP, navegador).
- Regenerar link (invalida o anterior).
- Atalho **Compartilhar no WhatsApp**: link *click-to-chat* (`wa.me`) com mensagem e link pré-preenchidos, e quem envia é o próprio usuário (sem API do WhatsApp). Mensagem: "Olá! Segue o orçamento Nº 0001: <link>". Se o cliente tiver telefone, abre direto a conversa com ele.

### Plataforma
- Interface pt-BR, BRL, mobile-first.
- **PWA instalável** ("Adicionar à tela inicial"), abrindo como app. Sem modo offline.
- **Tema claro/escuro:** padrão "Automático" (segue o sistema do aparelho), com opção de fixar Claro ou Escuro no perfil. O PDF e a página do cliente são sempre claros.
- Termos de uso e política de privacidade (LGPD).

## Fora do MVP (explícito)

| Item | Motivo |
|---|---|
| Pagamentos, assinaturas, planos pagos | Produto gratuito até validar uso |
| Equipes / múltiplos usuários por conta | Público é freelancer individual |
| Nota fiscal, cálculo de impostos, integração contábil | Fora do propósito (ver delimitações) |
| Envio automático por e-mail/WhatsApp ao cliente final | Aumenta custo e complexidade; copiar link resolve |
| Modo offline do PWA | Complexidade de sincronização; o app exige conexão |
| Notificações via WhatsApp/SMS | Custo e APIs externas; e-mail + push cobrem |
| Assinatura digital com validade jurídica | Complexidade legal |
| Cobrança, boleto, Pix, parcelamento | Não é meio de pagamento |
| Multi-moeda, multi-idioma | Mercado é só Brasil |
| App mobile nativo | Web mobile-first atende |
| Magic link, MFA | Reavaliar pós-MVP |
| Impostos por item | Não é emissor fiscal |
| Status "cancelado" / "arquivado" | Excluir cobre o caso (RN-29) |
| Reabrir orçamento respondido | Resposta é definitiva (RN-32); duplicar cobre o caso |
| Versionamento visível de orçamentos | Registro interno de versão basta (RN-24) |
| Modelos (templates) de orçamento | Duplicar cobre o caso |
| Personalização visual do PDF (cores, layouts) | Um layout bom e fixo no MVP |
| Relatórios e dashboards | Lista com filtro de status basta |
| Monitoramento de erros (Sentry) | Reavaliar em M7 |

## Futuro (pós-MVP)

Em ordem de prioridade (decidida pelo usuário):

1. **Modelos de orçamento**
2. **Relatórios simples** (taxa de aprovação, valor aprovado no mês)
3. **Personalização da cor do PDF e do link**
4. **Monetização** (freemium)

Sem prioridade definida: envio de e-mail ao cliente pelo sistema, MFA, magic link.

Ideias novas entram como issue no Linear em **Backlog sem milestone** até serem promovidas para o escopo.
