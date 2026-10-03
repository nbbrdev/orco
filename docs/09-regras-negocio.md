# 09 — Regras de negócio

> Status: **✅ todas as regras validadas pelo usuário em 2026-09-27.** Novas regras entram como `⏳` até serem aprovadas.
> Última atualização: 2026-09-27
>
> Regras são numeradas (`RN-xx`) e **nunca renumeradas**. Uma regra removida fica marcada como ~~revogada~~. Código, testes e issues referenciam o número.

## Conta e perfil

| # | Regra | Status |
|---|---|---|
| RN-01 | Uma conta pertence a uma única pessoa. Não existe compartilhamento de conta nem equipe. | ✅ |
| RN-02 | O e-mail precisa ser confirmado antes do primeiro acesso (cadastro por e-mail + senha). Login com Google dispensa a confirmação. | ✅ |
| RN-03 | Senha com no mínimo **8 caracteres**, sem exigência de tipos de caractere. | ✅ |
| RN-04 | Nenhum campo do perfil é obrigatório para criar ou enviar orçamentos. Campos do perfil: nome de exibição, nome comercial, logo, telefone, e-mail de contato, CPF/CNPJ, site, Instagram e **dados de pagamento** (texto livre, ex.: "Pix: chave…"; só informativo, o Orçô não processa pagamentos). Todos os preenchidos aparecem no PDF e no link. O nome exibido segue esta ordem: nome comercial → nome de exibição → e-mail da conta. | ✅ |
| RN-05 | Logo: PNG, JPEG ou WebP, **até 5 MB** no arquivo original. SVG não é aceito. Antes do upload, o app redimensiona a imagem no navegador (lado maior até 1024 px, WebP) para economizar armazenamento e manter o PDF leve. | ✅ |
| RN-06 | A exclusão da conta apaga imediata e definitivamente perfil, clientes, catálogo, orçamentos, eventos e logo. Os links públicos param de funcionar. A ação pede confirmação digitando "EXCLUIR". | ✅ |

## Clientes

| # | Regra | Status |
|---|---|---|
| RN-07 | Só o **nome** do cliente é obrigatório. E-mail, telefone, CPF/CNPJ, endereço e **observações internas** são opcionais. As observações internas são privadas: nunca aparecem no orçamento, no PDF ou no link, e não entram no snapshot (RN-20). | ✅ |
| RN-08 | Se informado, o CPF/CNPJ é validado pelo dígito verificador. E-mail e telefone são validados apenas no formato. O CNPJ aceita também o formato **alfanumérico** da Receita, em vigor desde julho de 2026 (decidido em 2026-10-02, NBB-42). O telefone é **brasileiro, com DDD** (10 ou 11 dígitos), guardado como `(11) 91234-5678`; telefone e CPF/CNPJ têm máscara enquanto se digita (decidido em 2026-10-03, NBB-84). | ✅ |
| RN-09 | **Não é possível excluir um cliente que tenha orçamentos.** A tela explica: "Este cliente tem N orçamentos. Exclua-os antes de excluir o cliente." A regra é garantida pelo banco (FK). Editar os dados de um cliente não altera orçamentos existentes (RN-20). | ✅ |

## Catálogo

| # | Regra | Status |
|---|---|---|
| RN-10 | Um item de catálogo tem nome (obrigatório), preço unitário (**opcional**, ≥ R$ 0,00 quando informado) e unidade (opcional, texto livre curto: "h", "un", "m²"…). Um item sem preço entra no orçamento com o valor vazio, a ser preenchido (RN-13). | ✅ |
| RN-11 | Excluir um item do catálogo não altera nenhum orçamento. Ao **editar** nome, unidade ou preço de um item usado em **rascunhos**, o app pergunta "Atualizar também os N rascunhos que usam este item?"; se sim, as linhas desses rascunhos são atualizadas. Orçamentos enviados, aprovados, recusados ou expirados **nunca** são alterados (RN-20). | ✅ |

## Orçamento: conteúdo e cálculo

| # | Regra | Status |
|---|---|---|
| RN-12 | **Numeração:** sequencial por usuário, começando em 1, atribuída na criação e exibida como `Nº 0001`. Números nunca são reutilizados, então lacunas por exclusão são aceitas. | ✅ |
| RN-13 | Um rascunho pode ter qualquer campo vazio. Para **enviar**, exige ao menos 1 item; **todo** item precisa ter descrição, quantidade > 0 e valor unitário preenchido (R$ 0,00 é válido). O **cliente é opcional**: sem cliente, o PDF e o link omitem o bloco do destinatário. | ✅ |
| RN-14 | Item: descrição (obrigatória), quantidade (> 0, até 3 casas decimais, ex.: 1,5 h), unidade (opcional), valor unitário (≥ R$ 0,00), **desconto do item** (opcional). Limite de 100 itens por orçamento. A ordem dos itens é a da tela e pode ser mudada arrastando (incluído em 2026-10-03, NBB-86). | ✅ |
| RN-15 | Todos os valores monetários são inteiros em **centavos**, com arredondamento **meio-para-cima** ao centavo (ex.: R$ 49,995 → R$ 50,00). Bruto da linha = `arredonda(quantidade × valor unitário)`. Total da linha = bruto da linha − desconto do item. | ✅ |
| RN-15a | **Desconto do item:** percentual (0–100%, até 2 casas) ou valor fixo em R$, aplicado sobre o bruto da linha. Nunca excede o bruto da linha. No editor, fica **escondido até ser pedido** (menu "⋯" do item → "Adicionar desconto"). | ✅ |
| RN-15b | **Exibição para o cliente** (PDF e link): a coluna de desconto por item só aparece se algum item tiver desconto, e a linha de desconto geral só aparece se ele existir. | ✅ |
| RN-16 | Subtotal = soma dos totais das linhas (já com os descontos dos itens). Exemplo: Logo 1 × R$ 800 com 10% (R$ 720) + Site 1 × R$ 2.000 → subtotal R$ 2.720; desconto geral R$ 220 → total R$ 2.500. | ✅ |
| RN-17 | **Desconto geral:** percentual (0–100%, até 2 casas) ou valor fixo em R$, aplicado sobre o subtotal. Arredondado ao centavo e nunca maior que o subtotal. | ✅ |
| RN-18 | Total = subtotal − desconto geral, nunca negativo. | ✅ |
| RN-44 | **Condições de pagamento** (ex.: "50% na entrada, 50% na entrega") e **prazo de execução** (ex.: "15 dias úteis após aprovação") são campos de texto opcionais do orçamento (≤ 500 caracteres), com valores padrão configuráveis no perfil. Aparecem destacados no PDF e no link. Não confundir com os "dados de pagamento" do perfil (RN-04), que dizem *para onde* pagar. | ✅ |
| RN-19 | **Validade:** data final (inclusiva) do orçamento, **obrigatória**. O padrão é hoje + N dias, com N vindo do perfil (padrão do sistema: **15**), e pode ser alterada em cada orçamento. Datas no fuso America/Sao_Paulo. | ✅ |
| RN-20 | **Snapshot:** o orçamento guarda **cópia** dos dados do cliente e de cada item no momento em que são adicionados. Alterações posteriores em cliente/catálogo não afetam orçamentos enviados, aprovados, recusados ou expirados. Para **rascunhos**, ao editar um cliente ou item de catálogo o app pergunta "Atualizar também os N rascunhos que usam este cliente/item?" (ver RN-11). Editar o orçamento atualiza apenas a cópia dele. | ✅ |
| RN-20a | **Anotações internas do orçamento:** campo privado (nunca aparece no PDF, no link nem para o cliente), editável em **qualquer** status, inclusive aprovado/recusado, e que não incrementa a versão (RN-24). | ✅ |
| RN-21 | O orçamento é salvo automaticamente enquanto é editado (debounce ~800 ms), sem botão "Salvar". | ✅ |

## Orçamento: status e ciclo de vida

```
rascunho ──enviar──▶ enviado ──cliente aprova──▶ aprovado
                        │    ──cliente recusa──▶ recusado
                        └── validade passa ────▶ expirado ──prorrogar validade──▶ enviado
```

| # | Regra | Status |
|---|---|---|
| RN-22 | **Enviar** acontece automaticamente na primeira vez que o freelancer **compartilha** um rascunho que atende à RN-13: copiar o link, baixar o PDF ou abrir o WhatsApp. Não existe botão "marcar como enviado". | ✅ |
| RN-22a | **Visualizar** (prévia do PDF na tela, sem download) **não** altera o status. O freelancer pode conferir quantas vezes quiser antes de compartilhar. | ✅ |
| RN-23 | Um orçamento `enviado` pode ser editado livremente. O cliente sempre vê a versão atual ao abrir o link. | ✅ |
| RN-24 | Cada edição de um orçamento já enviado incrementa um **número de versão interno**. A aprovação/recusa registra qual versão o cliente viu. Esse histórico não aparece para o usuário no MVP. | ✅ |
| RN-25 | Orçamentos `aprovado` e `recusado` ficam **travados** (somente leitura), com uma única exceção: as anotações internas (RN-20a). Para alterar qualquer outra coisa, o freelancer duplica. | ✅ |
| RN-26 | Um orçamento `enviado` passa a `expirado` após o fim do dia da validade (fuso America/Sao_Paulo). O status é calculado na leitura, sem job agendado. | ✅ |
| RN-27 | Prorrogar a validade de um orçamento `expirado` o devolve a `enviado`, e o mesmo link continua valendo. | ✅ |
| RN-28 | **Duplicar** cria um novo `rascunho` com novo número, os mesmos itens, cliente, descontos, condições de pagamento, prazo de execução e observações, e validade recalculada a partir de hoje. As anotações internas (RN-20a) **não** são copiadas. | ✅ |
| RN-29 | Excluir é permitido em qualquer status, com confirmação. Um orçamento excluído some da lista e o link deixa de funcionar. Não existe status "cancelado" nem "arquivado": para desistir de um orçamento, o freelancer exclui. | ✅ |

## Link público e resposta do cliente

| # | Regra | Status |
|---|---|---|
| RN-30 | Cada orçamento tem um token público aleatório de 256 bits (43 caracteres). Quem tem o link vê o orçamento; ninguém consegue listar ou adivinhar links. O token não deriva do número nem do ID. | ✅ |
| RN-31 | O link só exibe o orçamento se o status for `enviado`, `aprovado`, `recusado` ou `expirado`. Rascunho, orçamento excluído ou token inválido mostram a mesma página genérica de "orçamento não encontrado". | ✅ |
| RN-32 | O cliente só pode aprovar ou recusar um orçamento `enviado` dentro da validade. A resposta é **única e definitiva**: nem o cliente nem o freelancer podem desfazê-la. Depois dela, a página mostra o resultado. Se o cliente mudar de ideia, o freelancer duplica e reenvia. | ✅ |
| RN-33 | Aprovar pede confirmação ("Confirmar aprovação?") e aceita um campo **opcional** "Seu nome". Recusar aceita um **motivo opcional**: chips rápidos (**Preço**, **Prazo**, **Desisti**, **Outro**) e/ou texto livre. | ✅ |
| RN-34 | Toda resposta registra data/hora, IP, navegador (user agent), versão (RN-24) e o nome ou motivo informado. | ✅ |
| RN-35 | A primeira visualização do link por alguém que não seja o dono registra o evento "visualizado", e o freelancer vê "Cliente visualizou em …". Visualizações seguintes só incrementam um contador. Acessos de **robôs de pré-visualização** (WhatsApp, Telegram, Slack, Facebook, iMessage, Google etc., identificados pelo user agent) são ignorados. | ✅ |
| RN-36 | Regenerar o link invalida o token anterior imediatamente. | ✅ |
| RN-37 | O IP registrado nos eventos é mantido por **12 meses** e depois anonimizado. | ✅ |

## Notificações

| # | Regra | Status |
|---|---|---|
| RN-40 | Quando o cliente **aprova** ou **recusa**, o freelancer recebe um **e-mail** ("Maria aprovou o orçamento Nº 0012", com o motivo, se houver, e um link para o orçamento no app). O nome segue esta ordem: nome informado na aprovação → nome do cliente do orçamento → "Seu cliente". Visualizações não geram e-mail. | ✅ |
| RN-41 | Os e-mails de notificação (respostas, RN-40, e lembretes, RN-43) vão para o e-mail da conta. **Um único botão** no perfil liga/desliga todos eles; o padrão é ligado. | ✅ |
| RN-42 | Uma falha no envio de e-mail ou push **não** impede nem desfaz a resposta do cliente. Não há nova tentativa automática no MVP. O status no app é sempre a fonte da verdade, e a lista destaca respostas não vistas com "novo". | ✅ |
| RN-43 | **Lembrete de vencimento:** uma vez por dia, orçamentos `enviado` sem resposta cuja validade termina **amanhã** geram um lembrete ao freelancer ("O orçamento Nº 0012 (Maria) vence amanhã e ainda não foi respondido"), por e-mail (se RN-41 ligado) e push (se ativo, RN-45). Cada orçamento recebe no máximo **um** lembrete por validade; se a validade for prorrogada, pode receber outro. | ✅ |
| RN-45 | **Notificações push** (Web Push): a permissão é pedida **uma única vez, logo após o 1º orçamento enviado** ("Quer ser avisado quando o cliente responder?"), e pode ser ativada depois no perfil. É ativada **por aparelho** (cada celular/navegador é uma assinatura). Eventos: cliente aprovou/recusou, lembrete de vencimento (RN-43) e cliente visualizou (1ª visualização, RN-35). No iPhone, só funciona com o Orçô instalado na tela inicial (iOS 16.4+). | ✅ |

## Limites e anti-abuso

| # | Regra | Status |
|---|---|---|
| RN-38 | Limites por conta para evitar abuso do serviço gratuito: **200 orçamentos criados por mês**, **1.000 clientes**, **500 itens de catálogo**. Ao atingir um limite, a mensagem é clara e diz quando o limite volta. | ✅ |
| RN-39 | As rotas públicas (link, aprovar/recusar) e a geração de PDF têm limite de requisições por minuto: link 60/IP, aprovar/recusar 5/IP+token, PDF 20/usuário (dono) e 10/IP (público). Valores iniciais, calibrados na M7. | ✅ |
| RN-46 | **Anti-abuso do cadastro por e-mail, sem CAPTCHA externo** (decidido em 2026-09-29). (1) **Limite por IP:** 3 cadastros por hora; ao exceder, "Muitas tentativas. Tente de novo em alguns minutos." (2) **Campo "isca" (honeypot):** invisível para pessoas; se vier preenchido, o servidor mostra a mesma tela de sucesso, sem criar conta nem enviar e-mail. (3) **Teto diário de e-mails de cadastro:** 60 por dia (horário de Brasília), somando confirmações e reenvios de todas as contas; ao atingir, o cadastro por e-mail fica pausado até o dia seguinte com "Estamos com muitos cadastros hoje. Tente amanhã ou use Continuar com Google." Login, recuperação de senha e Google continuam normais. (4) **Reenviar o e-mail de confirmação:** 3 por hora por IP, contando no teto diário; mesma resposta exista ou não a conta (decidido em 2026-10-02, NBB-39). Valores iniciais, calibrados na M7. | ✅ |
