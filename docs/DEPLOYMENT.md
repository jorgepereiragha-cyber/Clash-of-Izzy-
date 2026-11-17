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

O projeto usa **Cloudflare Workers** (`main: "worker.js"`) e `wrangler.jsonc`, não Cloudflare Pages. Não use `wrangler pages deploy`, `[env.preview]` de Pages ou um `wrangler.toml` paralelo. Para testar uma branch, use `wrangler preview`; para produção, o comando separado continua sendo `wrangler deploy`.

O projeto já fixa Wrangler 4.161.0, versão que atende ao requisito mínimo 4.135.0 de Worker Previews. O bloco `previews.vars.ENVIRONMENT` deve permanecer como `"preview"`.

### 1. Criar o banco D1 de staging

Em um terminal autenticado na conta Cloudflare correta:

```sh
npx wrangler --config wrangler.jsonc d1 create clash-of-izzy-preview
```

Guarde o `database_id` real retornado. Ele precisa ser diferente do ID do D1 de produção (`7e63af59-d9ff-4159-a9cf-b02e35b92605`). Não use o banco de produção, não reutilize UUIDs e não preencha o exemplo com um valor fictício.

### 2. Vincular o banco somente ao Worker Preview

No `wrangler.jsonc`, mantenha o `d1_databases` do topo inalterado e acrescente `d1_databases` dentro do bloco `previews`, com o UUID real:

```jsonc
"previews": {
  "vars": {
    "ENVIRONMENT": "preview"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "clash-of-izzy-preview",
      "database_id": "COLE_AQUI_O_UUID_REAL_DO_STAGING",
      "migrations_dir": "migrations"
    }
  ]
}
```

O binding permanece `DB` porque o Worker acessa o banco como `env.DB`. O banco referenciado em `previews.d1_databases` deve ser o mesmo usado pela configuração de migrações abaixo.

### 3. Criar o arquivo de migrações de Preview

Crie `wrangler.preview-migrations.jsonc` na raiz com o mesmo ID do D1 de staging:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "d1_databases": [
    {
      "binding": "PREVIEW_DB",
      "database_name": "clash-of-izzy-preview",
      "database_id": "COLE_AQUI_O_MESMO_UUID_REAL_DO_STAGING",
      "migrations_dir": "migrations"
    }
  ]
}
```

Esse arquivo de migração deve apontar para exatamente o mesmo banco que o binding `DB` do Preview. Nunca aplique migrações remotas do Preview pelo arquivo principal de produção.

### 4. Aplicar migrações e publicar a branch

```sh
npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc
npx wrangler --config wrangler.jsonc preview --name feat-visual-quality-mobile-3d
```

Execute a publicação do Preview somente depois de as migrações de staging terminarem com sucesso.

### 5. Configurar segredos exclusivos do Preview

Worker Previews não herdam automaticamente os segredos de produção. Depois de criar o Preview, cadastre segredos próprios para ele (o Wrangler solicita cada valor sem gravá-lo no repositório):

```sh
npx wrangler preview secret put SESSION_SECRET --name feat-visual-quality-mobile-3d
npx wrangler preview secret put ADMIN_EMAIL --name feat-visual-quality-mobile-3d
npx wrangler preview secret put ADMIN_PASSWORD --name feat-visual-quality-mobile-3d
```

Use um `SESSION_SECRET` aleatório e credenciais administrativas descartáveis, exclusivos do Preview. Não copie os segredos de produção.

### 6. Validar o ambiente isolado

1. Confirme no painel que o Preview usa o D1 `clash-of-izzy-preview` através do binding `DB`, nunca o D1 `clash-of-izzy-db`.
2. Abra `/api/admin/health` no URL do Preview e confirme `hasDB`, `hasSESSION_SECRET`, `hasADMIN_EMAIL` e `hasADMIN_PASSWORD` como `true`.
3. Faça testes com contas descartáveis: criação de reino, leitura de estado, construção, marcha, aliança e busca.
4. Valide PWA standalone, carregamento 3D e offline em Android físico; guarde apenas evidências sanitizadas.
5. Mantenha a PR em Draft até concluir essas verificações.

**Estado verificado nesta branch:** `wrangler.jsonc` já define `ENVIRONMENT="preview"`, mas ainda não contém um binding D1 de staging. O banco precisa ser criado na conta Cloudflare e seu ID real inserido nos dois arquivos. Nenhum banco, segredo, migração remota ou deploy é criado por esta documentação.
