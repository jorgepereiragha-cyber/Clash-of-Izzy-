# Publicação do Clash of Izzy

## Publicação em produção (manual e protegida)

O workflow `.github/workflows/deploy-cloudflare.yml` é acionado manualmente (`workflow_dispatch`) e exige confirmação explícita de produção. Ele executa nesta ordem:

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

1. Consulte `GET /api/health` e confirme que a API retorna `status: "ready"`, D1 conectado e schema completo.
2. Confirme que `GET /api/admin/health` sem sessão retorna **HTTP 401**. Um token de jogador também deve receber 401.
3. Faça login no painel Master por `POST /api/admin/login`; somente o Bearer token administrativo válido pode consultar `GET /api/admin/health` (HTTP 200).
4. Abra o jogo, confirme que o status do reino não mostra “Modo demonstração” e valide uma ação de jogo.
5. Teste o painel administrativo com a sessão Master. Não copie tokens para logs, issues ou mensagens públicas.

O endpoint administrativo informa apenas indicadores de configuração e exige autenticação Master; ele nunca deve ser usado como diagnóstico público.
