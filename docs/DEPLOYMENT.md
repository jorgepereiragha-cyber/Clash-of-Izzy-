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


## Preparação de Workers Paid — validação em nuvem

O workflow `.github/workflows/cloudflare-paid-readiness.yml` é manual e somente de leitura. Ele foi criado para que a revisão da conta Cloudflare seja executada pelo GitHub Actions sem exigir comandos em um computador local.

Antes de executá-lo:
1. Ative Workers Paid na conta Cloudflare pelo Dashboard de Billing.
2. Revise spending limits e alertas de Workers e Durable Objects. Workers spending limit não é limite total da fatura e pode interromper todos os Workers da conta ao ser atingido.
3. Em GitHub **Settings → Secrets and variables → Actions**, confirme `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` já usados pelo deploy protegido.
4. Em **Actions → Cloudflare Paid Readiness (read-only) → Run workflow**, escolha a branch de lançamento e marque a confirmação de que o plano Paid está ativo e os limites/alertas foram revisados.

O workflow:
- executa testes e Wrangler dry-run;
- valida acesso à conta Cloudflare;
- consulta os metadados dos dois D1 e exige UUIDs distintos;
- consulta apenas a listagem de migrations pendentes e Time Travel;
- não cria recursos, não altera secrets, não aplica migrations e não publica o Worker.

O status Paid é uma confirmação do proprietário no Dashboard; `wrangler whoami` não prova o nível de assinatura. Se o D1 Preview não existir ou o UUID não corresponder, o workflow falha e nenhuma tentativa de criar ou substituir o banco é feita.

## Plano pago e backup D1

D1 Time Travel não precisa ser habilitado nem depende de Cron. Para databases no novo storage backend, ele mantém recuperação ponto-no-tempo automaticamente: até 30 dias no Workers Paid e 7 dias no Free. Confirme `version: beta` em `wrangler d1 info`; bancos `alpha` usam o backend legado. Restaurar um bookmark sobrescreve o banco atual; deve ser tratado como operação destrutiva e executado somente com aprovação, bookmark anterior anotado e plano de reversão.

Links oficiais:
- [Workers Paid pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers spending limits](https://developers.cloudflare.com/workers/platform/spend-management/)
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
