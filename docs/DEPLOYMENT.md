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
