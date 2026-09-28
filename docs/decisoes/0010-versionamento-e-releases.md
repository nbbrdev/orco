# ADR-0010 — Versionamento semântico e releases com release-please

- **Status:** aceito (validado pelo usuário em 2026-09-27)
- **Data:** 2026-09-27

> **Revisão (2026-09-28, NBB-63, decisão do usuário):** o **release-please foi abandonado** para reduzir a complexidade. Sem PR de release, sem `CHANGELOG.md`, sem `release.yml` e sem status update no Linear.
>
> **Como fica:**
> - o **usuário** escolhe o número (SemVer, pelos títulos dos PRs) e cria a versão com `gh release create vX.Y.Z --target main --generate-notes`, que gera a tag e as notas a partir dos títulos dos PRs;
> - o workflow `production.yml` (gatilho: release publicada) confere a tag (formato, commit na `main`, CI verde), aplica as migrations no `orco-prod` e publica via `deploy-vercel.yml --prod`;
> - staging continua automático a cada merge (`staging.yml`);
> - "produção = tag" continua valendo;
> - a versão exibida no app vem da tag (`NEXT_PUBLIC_APP_VERSION`), e o `package.json` fica `0.0.0`;
> - o agente nunca cria tags.
>
> **Motivo técnico adicional:** PRs e releases criados pelo release-please com o `GITHUB_TOKEN` não disparam outros workflows. O CI não rodaria no PR de release e o deploy não seria disparado, e resolver isso exigiria um token pessoal ou um GitHub App. Releases criadas pela conta do usuário disparam normalmente.
>
> O texto original segue abaixo como histórico.

## Contexto
O usuário quer controle de versão (major/minor/patch) e que **toda versão em produção corresponda a uma tag** no commit publicado. Por padrão, a Vercel publica em produção a cada push na `main`, o que deixaria produção e versões descasadas.

## Decisão

### Versionamento
- **SemVer** (`MAJOR.MINOR.PATCH`), calculado automaticamente a partir dos **Conventional Commits**: `fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE` → major.
- Fase **0.x** até o lançamento: `0.1.0` ao fim da M1, um minor por milestone, **`1.0.0` no go-live (M7)**. Em 0.x, mudanças que quebram sobem apenas o minor.
- A versão aparece discretamente no app (rodapé do perfil: "Orçô v0.4.0", com link para as notas).

### Releases com release-please
1. Merges na `main` → deploy automático só em **staging** (`https://staging.orco.nbbrdev.com`: Vercel Preview da `main` + banco `orco-staging`, protegido por Basic Auth exceto `/p/*`).
2. O **release-please** (GitHub Action) mantém um **PR de release** aberto (`chore(main): release X.Y.Z`) com `CHANGELOG.md` e a versão do `package.json` atualizados.
3. O usuário decide lançar → **merge do PR de release** → tag `vX.Y.Z` + **GitHub Release**.
4. O evento de release dispara `.github/workflows/release.yml`:
   1. `supabase db push` no **orco-prod**;
   2. deploy do commit da tag com a **Vercel CLI no GitHub Actions**: `vercel pull --environment=production` → `vercel build --prod` → `vercel deploy --prebuilt --prod` (token em `VERCEL_TOKEN`);
   3. publica as notas da versão como **status update do projeto no Linear**.

### Garantias
- **Deploy automático de produção da Vercel desligado.** Produção só via workflow de release, então **produção = tag**.
- Título de PR validado por lint (`amannn/action-semantic-pull-request`), já que o squash merge usa o título como commit.
- Changelog em **`CHANGELOG.md`** (repo) + **GitHub Releases** + **Linear** (status update).

### Vercel
> **Revisão (2026-09-28, NBB-35, validada pelo usuário):** a integração Git da Vercel foi **desligada** e **todos** os deploys saem do GitHub Actions pela receita reutilizável `deploy-vercel.yml`: o staging via `staging.yml` (após o CI verde na `main`, com as migrations antes do código) e a produção via `production.yml` (revisão NBB-63, acima). **Não há preview por PR.** Sem ambiente *Development* na Vercel: as chaves locais ficam no `.env.local`. O texto original está abaixo, riscado.

- ~~A integração Git **continua ligada** para previews (PRs e `main`, com env vars de staging).~~
- A **promoção automática da `main` para produção fica desligada**: produção só via CLI no workflow de release.
- ~~**Localmente**, a CLI é usada para `vercel env pull` (gera o `.env.local`). As variáveis do ambiente *Development* na Vercel apontam para o Supabase local (Docker).~~

## Alternativas descartadas
- **Tag a cada merge com deploy contínuo:** sem controle de quando lançar e excesso de versões.
- **Branch `production` separada:** duas branches longas para sincronizar, mais propenso a erro.
- **Branch de produção empurrada pelo CI:** evitaria o token, mas cria uma branch extra.
- **`vercel promote` do preview:** o preview foi compilado com env vars de staging; a promoção precisaria recompilar, sem ganho sobre `build --prod`.
- **Deploy Hook:** compila o último commit de uma branch, não um commit específico.

## Consequências
- Novos arquivos: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`, `.github/workflows/pr-title.yml`.
- Novos segredos no GitHub: `VERCEL_TOKEN` (environments `staging` e `production`), `LINEAR_API_KEY`; `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` como variables do repositório.
- Migrations de produção passam a rodar **no release**, junto com o código correspondente.
- Hotfix = PR `fix:` → merge → merge do PR de release (patch) → produção em minutos.
