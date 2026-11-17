# Publicação do Clash of Izzy

## Publicação automática

O workflow `.github/workflows/deploy-cloudflare.yml` executa nesta ordem:

1. valida o bundle do Worker com `wrangler deploy --dry-run`;
2. aplica todas as migrações em um D1 local descartável para detectar erros SQL antes de tocar na produção;
3. aplica as migrações pendentes no D1 remoto `clash-of-izzy-db`;
4. publica o Worker e os arquivos estáticos.

As migrações ficam em `migrations/`. Não renomeie nem reutilize nomes de migrações já aplicadas.

## Segredos do GitHub Actions

Em **Settings → Secrets and variables → Actions**, cadastre:

- `CLOUDFLARE_API_TOKEN`: token da Cloudflare com permissões de edição de Workers Scripts e D1 para a conta do projeto;
- `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare que contém o Worker e o banco D1.

## Segredos do Worker

Os segredos de execução do Worker são diferentes dos segredos do GitHub Actions. Configure-os no ambiente do Worker na Cloudflare:

- `SESSION_SECRET`: segredo aleatório forte, longo e exclusivo; não reutilize senha pessoal;
- `ADMIN_EMAIL`: endereço usado no login administrativo;
- `ADMIN_PASSWORD`: senha forte e exclusiva do painel.

Também é possível cadastrá-los com Wrangler, em um terminal autenticado na conta correta:

```sh
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
```

O Wrangler solicita o valor de cada segredo sem colocá-lo no repositório. Nunca grave esses valores em arquivos versionados, no código do jogo ou em mensagens públicas.

## Verificação após a publicação

1. Abra `/api/admin/health` no domínio do Worker e confirme `hasDB`, `hasSESSION_SECRET`, `hasADMIN_EMAIL` e `hasADMIN_PASSWORD` como `true`.
2. Abra o jogo e confirme que o status do reino não mostra “Modo demonstração”.
3. Confirme que o endpoint `POST /api/game/start` cria um reino e que `GET /api/game/state`, com o token retornado, carrega o estado.
4. Teste uma ação de jogo e o painel administrativo.

O endpoint de saúde informa somente a presença das configurações; ele não revela os valores dos segredos.

## Preview do Cloudflare Worker com D1 de staging isolado

O projeto usa **Cloudflare Workers** (`main: "worker.js"`) e `wrangler.jsonc`, não Cloudflare Pages. Não use `wrangler pages deploy`, configuração de Pages ou um `wrangler.toml` paralelo. Para testar uma branch, use Worker Previews; para produção, o comando separado continua sendo `wrangler deploy`.

O projeto fixa Wrangler 4.161.0. O bloco `previews.vars.ENVIRONMENT` deve permanecer como `"preview"`.

### 1. Banco D1 de staging provisionado e configurado

A branch `feat/visual-quality-mobile-3d` já contém a configuração de staging nos dois arquivos:

- `wrangler.jsonc`: binding `DB` em `previews.d1_databases`;
- `wrangler.preview-migrations.jsonc`: binding de migração `PREVIEW_DB`;
- Nome do banco: `izzy-preview-17112026`;
- ID do staging: `6674c0ac-3636-4e57-bff8-23cf60ab9637`;
- ID de produção, mantido separado: `7e63af59-d9ff-4159-a9cf-b02e35b92605`.

Os dois arquivos de Preview apontam para o mesmo ID de staging. Não altere o binding D1 de produção para executar testes. A presença da configuração comprova o isolamento declarado no código, mas não comprova por si só que as migrações remotas foram aplicadas ou que o Worker Preview consegue executar consultas.

### 2. Aplicar migrações exclusivamente no staging

O script versionado no `package.json` é:

```sh
npm run db:migrate:preview:remote
```

Ele usa `wrangler.preview-migrations.jsonc` e o binding `PREVIEW_DB`. Antes de executar, confirme que o terminal está autenticado na conta Cloudflare correta e confira novamente o ID do banco. Nunca use `db:migrate:remote` para preparar o Preview: esse script aponta para a configuração principal de produção.

A CI valida as migrações de Preview em D1 local descartável. Essa validação automatizada não equivale à aplicação remota no banco de staging.

### 3. Preview e segredos exclusivos

O Preview publicado pela branch está disponível em:

`https://feat-visual-quality-mobile-3d-clash-of-izzy.jorgepereiragha.workers.dev`

O comentário automático do Cloudflare na PR identifica o Preview mais recente como commit `bae6e0b`. Confirme sempre o commit associado à implantação antes de registrar evidências.

Worker Previews não devem reutilizar segredos de produção. Configure credenciais descartáveis e exclusivas no ambiente Preview, sem gravá-las no repositório. Não copie `SESSION_SECRET`, `ADMIN_EMAIL` ou `ADMIN_PASSWORD` da produção.

### 4. Validar o ambiente isolado

1. No painel Cloudflare, confirme que o Preview usa `izzy-preview-17112026` pelo binding `DB`, nunca o D1 de produção.
2. Abra `/api/admin/health` no URL do Preview e confirme `hasDB`, `hasSESSION_SECRET`, `hasADMIN_EMAIL` e `hasADMIN_PASSWORD` como `true`. O endpoint informa presença, não valores.
3. Use contas descartáveis para testar criação de reino, leitura de estado, construção, marcha, aliança e busca.
4. Valide PWA standalone, carregamento 3D e reabertura offline em Android físico; guarde apenas evidências sanitizadas.
5. Mantenha a PR em Draft até concluir essas verificações e anexar as evidências.

### 5. Estado de validação em 17/11/2026

- **Configurado no repositório:** binding D1 de Preview e arquivo separado de migrações apontam para o mesmo ID de staging.
- **CI #932:** sucesso; inclui validação local das migrações D1 de produção e Preview, testes do Worker/D1, Chromium, assets 3D e bundle.
- **Ainda não comprovado por essa CI:** aplicação das migrações no D1 remoto de staging, presença dos segredos exclusivos no Preview, respostas funcionais das rotas autenticadas e inspeção Android física.
- **Android:** a landing foi aprovada no registro de inspeção; a modal requer reteste cosmético do foco; cidade 3D, texturas, sombras/iluminação e PWA standalone/offline continuam pendentes de evidência física.

Não declare o Preview operacional para gameplay autenticado apenas porque o deploy terminou com sucesso ou porque os testes locais passaram. Não mescle a PR enquanto os gates remotos e físicos acima permanecerem pendentes. Nenhuma instrução deste documento autoriza migração no banco de produção, alteração de segredos ou modificação de dados de jogadores.
