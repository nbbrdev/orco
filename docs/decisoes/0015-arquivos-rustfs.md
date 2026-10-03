# ADR-0015 — Arquivos (logos) no RustFS

- **Status:** aceito (decidido pelo usuário em 2026-09-29)
- **Data:** 2026-09-29
- **Substitui:** o Storage do Supabase (bucket `logos`, ADR-0001/0008)

## Contexto
O único arquivo enviado pelos usuários no MVP é o **logo** do freelancer (RN-05). Ele chega ao servidor já reduzido no navegador (WebP até 1024 px, dezenas a centenas de KB) e aparece no app, na página pública do orçamento e no PDF.

## Decisão
- **RustFS**: armazenamento de objetos **compatível com S3**, em container, **um por ambiente** (serviço `rustfs` do projeto Compose, ADR-0012), com volume próprio e **sem porta pública**.
- O app usa a biblioteca oficial **`@aws-sdk/client-s3`**. Por ser compatível com S3, trocar por MinIO, Cloudflare R2, Backblaze B2 ou AWS S3 é **só configuração** (endpoint e chaves no `.env`).
- **Bucket** `logos`, com chaves `{user_id}/{uuid}.webp` (UUID gerado pelo servidor; o nome original é descartado).
- **Envio e troca** só pelo servidor, após validar sessão, tipo (PNG/JPEG/WebP; **SVG proibido**) e tamanho (até 5 MB).
- **Exibição** por uma **rota do app** que lê do RustFS. O logo aparece na página pública e no PDF, então a leitura é permitida para quem tem o caminho (UUID inadivinhável).
- **Versão fixa** da imagem do RustFS no compose (o projeto é jovem, de 2025); atualizar só após testar.
- Desenvolvimento local: RustFS no `compose.dev.yaml`.

## Alternativas descartadas
- **Logo dentro do Postgres:** backup único, mas mistura arquivos com dados relacionais.
- **Disco da VPS sem S3:** simples, mas prende o código ao sistema de arquivos local.
- **Serviço externo (R2/S3):** mais uma conta e mais chaves. Continua possível no futuro sem mudar o código.

## Consequências
- **Revisão (2026-09-30, decisão do usuário):** o RustFS **fica fora do backup**, que é manual e só do banco (ADR-0012). Risco aceito: poucos clientes; se a VPS for perdida, os logos são enviados de novo. Como o app trata um logo que não existe mais fica para a NBB-42.
- A **exclusão de conta** apaga explicitamente o logo da conta no RustFS (pelo `profiles.logo_path`), porque o armazenamento não participa da cascata do banco.

## Implementação (decidida pelo usuário em 2026-10-03, NBB-81)
- **L1:** o app cria o bucket `logos` sozinho, na primeira vez que precisa (`src/lib/storage`), em todos os ambientes.
- **L2:** o navegador reduz a imagem para até 1024 px e tenta WebP; o Safari não gera WebP pelo canvas, então lá vai PNG (mantém a transparência). O servidor confere o tipo pelos primeiros bytes e o tamanho, sem refazer a imagem (sem a biblioteca `sharp`).
- **L3:** upload por Server Action, com o limite aumentado para 5 MB (`serverActions.bodySizeLimit`), igual ao Nginx.
- **L4:** a chave é só `{uuid}.{ext}`, **sem o `user_id`**, porque o endereço é público e o docs/07 §4 proíbe expor IDs internos. A rota é `/api/p/logos/{arquivo}`, com cache imutável. Isso substitui a chave `{user_id}/{uuid}.webp` prevista acima.
- **L5:** o RustFS também entra como serviço no CI, e os testes de integração usam o RustFS de verdade.
- Novas variáveis de ambiente: endpoint, bucket e chaves do RustFS (só no servidor).
- Risco aceito: RustFS é recente. Mitigação: versão fixa e a portabilidade garantida pelo S3.
