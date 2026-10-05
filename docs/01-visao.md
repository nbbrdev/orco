# 01 — Visão

> Status: rascunho para validação · Última atualização: 2026-09-27

## Nome

**Orçô** — nome de exibição (marca, interface, PDF, e-mails).
Slug técnico: `orco` (repositório, subdomínio, pacotes, pastas, identificadores de código).

## Problema

Freelancers e autônomos (desenvolvedores, designers, eletricistas, fotógrafos, pintores, professores particulares…) montam orçamentos em Word, planilha, bloco de notas ou mensagem de WhatsApp. O resultado:

- aparência pouco profissional e inconsistente entre orçamentos;
- serviços e valores espalhados (em conversas, planilhas e na memória), sem um lugar central de onde tirar o orçamento;
- retrabalho: digitar os mesmos serviços, preços e dados do cliente a cada vez;
- erro de conta em totais e descontos;
- sem registro claro de quando o cliente aprovou, nem de qual versão;
- sem visão de quais orçamentos estão pendentes, aprovados ou esquecidos.

## Proposta

Um app web gratuito em que o freelancer **cria um orçamento bonito em menos de 2 minutos**, envia um **link** ao cliente (ou um **PDF**) e o cliente **aprova ou recusa com um toque**, sem precisar de conta.

## Público

| Ator | Descrição |
|---|---|
| **Freelancer** (usuário) | Profissional autônomo, conta individual, usa principalmente o celular. Pouca paciência para configuração. |
| **Cliente final** | Quem recebe o orçamento. Não tem conta, não instala nada, só abre um link. |

Fora do público no MVP: empresas com equipe, agências com múltiplos usuários por conta.

## Princípio central: simples, ágil e intuitivo

**Simplicidade é requisito, não acabamento.** Se o Orçô for trabalhoso, o freelancer volta para o WhatsApp. Toda decisão de produto e todo PR é avaliado contra estes princípios:

1. **Meta de ativação:** do cadastro ao primeiro orçamento enviado em **menos de 2 minutos**, sem tutorial.
2. **Onboarding mínimo:** cadastro pede só e-mail + senha ou Google. Perfil (nome, logo, contato) é opcional e pode ser completado depois; o PDF usa o que existir.
3. **Nada bloqueia o fluxo principal:** cliente e item podem ser criados **dentro do editor de orçamento**, sem sair da tela. Catálogo e lista de clientes são atalhos, não pré-requisitos.
4. **Defaults inteligentes:** validade padrão, numeração automática, quantidade 1, observações reaproveitáveis. O mínimo possível de campos obrigatórios.
5. **Salvamento automático:** rascunho nunca se perde; não existe botão "salvar" que se possa esquecer.
6. **Ação principal sempre à mão:** "Novo orçamento" a 1 clique de qualquer tela; "Copiar link" e "Baixar PDF" a 1 clique do orçamento.
7. **Mobile-first:** o freelancer orça no celular, muitas vezes na frente do cliente. Tudo usável com uma mão.
8. **Rápido:** LCP < 2,5 s e INP < 200 ms em 4G; interface otimista nas ações.
9. **Linguagem simples em pt-BR:** sem jargão. Estados vazios ensinam o próximo passo; mensagens de erro dizem como resolver.
10. **Cliente final sem atrito:** página do orçamento sem login, com dois botões claros: **Aprovar** / **Recusar**.
11. **Filtro de escopo:** qualquer feature que adicione passo, campo obrigatório ou tela ao fluxo principal precisa de justificativa escrita. Na dúvida, fica de fora.

## Modelo

Gratuito, sem pagamentos no MVP. Monetização será decidida depois do MVP validado (ver [02-escopo.md](02-escopo.md) → Futuro).

## Métricas de sucesso (pós-lançamento)

- % de cadastros que enviam o 1º orçamento em até 24 h (ativação).
- Tempo mediano do cadastro ao 1º orçamento enviado (meta < 2 min).
- Orçamentos enviados por usuário ativo por mês.
- % de orçamentos com resposta do cliente (aprovado/recusado) via link.

## Mercado

Brasil apenas: interface em **pt-BR**, moeda **BRL**, fuso **America/Sao_Paulo**. Sem internacionalização.
