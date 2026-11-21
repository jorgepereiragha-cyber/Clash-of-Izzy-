# Clash of Izzy — aferição de carga segura (21/11/2026)

## Objetivo

Medir o comportamento inicial de um *staging* isolado em ate 1.000 requisicoes de leitura
GET para `/api/health`, com limite de 50 requisicoes em voo, sem cadastrar contas,
editar D1, executar ordens ou acionar pagamentos.

**Isto nao prova capacidade para 1.000 jogadores online**. Nao mede
mil WebSockets persistentes, persistencia de batalha, escrita D1 concorrente,
login, movimentacao de tropas ou FPS no Android.

## Protecoes automaticas

- O script `scripts/staging-load-smoke.mjs` exige URL HTTPS limpa, com hostname
  de preview/staging de Clash of Izzy em `workers.dev` ou
  `staging.clashofbrazil.com`. Bloqueia os dominios de producao conhecidos.
- Rejeita URL com caminho, query, credenciais e porta nao padrao.
- Nao segue redirecionamentos: respostas 3xx contam como falha.
- Apenas GET em `/api/health`, sem cookie ou token.
- No maximo 1.000 requisicoes, 50 em paralelo, timeout individual de 8 segundos.
- Workflow de disparo *manual* com confirmacao de staging. Nunca executa em
  `push`, `pull_request` ou agenda; nao usa Cloudflare API Token.
- Falha quando taxa HTTP 200 fica abaixo de 99% ou p95 excede 1.500 ms.
  Esses limiares sao criterios de triagem, nao SLO comercial.

## Como executar pelo navegador

1. Criar/identificar um endpoint real de staging isolado. Confirmar no Cloudflare
   a URL, D1 de preview separado e limites financeiros.
2. Abrir **GitHub Actions > Clash of Izzy - staging load probe (read only)**;
   selecionar a branch que contem o workflow.
3. Preencher `target_url` com a **origem HTTPS** de staging (terminando em `/`),
   confirmar `confirm_staging`, selecionar carga inicial de 50 e 5 em paralelo.
4. Se a execução piloto for aprovada, progredir para 100, 250, 500 e 1.000
   requisicoes, maximo 50 simultaneas.
5. Guardar os logs com HTTP 200/5xx, p50, p95, p99, throughput e taxa de sucesso.
   Se falhar, investigar consultas D1, limitacao de CPU, observabilidade e cache
   antes de escalar.

Para executar localmente, sem tocar em producao:

```sh
CONFIRM_STAGING_LOAD=true \
LOAD_TARGET_URL=https://staging.clashofbrazil.com/ \
LOAD_REQUESTS=50 LOAD_CONCURRENCY=5 \
node scripts/staging-load-smoke.mjs
```

O dominio de exemplo acima **nao afirma que esse staging existe**.

## Etapas ainda necessarias para validar 1.000 jogadores

1. Em um D1 de homologacao descartavel, gerar identidades de teste isoladas,
   usando fixtures autorizadas e nunca contas reais.
2. Medir autenticacao, estado do reino, mapa de proximidade, compras internas
   *simuladas sem pagamento*, evolucao das filas e batalhas concorrentes.
3. Se a PR de WebSocket for aprovada, medir conexoes permanentes por sala e
   distribuicao entre Durable Objects, inclusive reconexao, heartbeat,
   limitação de sala e ausencia de perda de estado.
4. Capturar p95/p99, falhas, tempo de resposta D1, custo e recuperacao,
   com ramp-up/steady-state/soak test.
5. Validar WebGL, memoria, bateria, login e checkout em aparelhos Android reais.

**Nao executar benchmark pesado no Worker de producao nem migrações remotas
sem verificacao de custo, staging isolado e permissao operacional.**
