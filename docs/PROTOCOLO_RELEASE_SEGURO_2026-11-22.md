# Clash of Izzy — protocolo verificado de release (22/11/2026)

Estado: **NO-GO comercial**. Este documento não autoriza merge, deploy, migração, pagamentos ou restauração do D1.

## 1. Flags do Worker — não confundir strings e booleanos

A branch `main` define explicitamente em `wrangler.jsonc` como **strings**:
`GAME_4X_SYSTEMS_ENABLED="false"`,
`LEVEL_PACKS_ENABLED="false"`,
`LEVEL_PACKS_PUBLIC_ENABLED="false"` e
`LEVEL_PACKS_PROPOSED_PRICES_APPROVED="false"`.
O valor existente `ENVIRONMENT="production"` foi preservado.

A branch de feature `level-packs.js` compara com `=== "true"`. Nunca ativar as flags na `main` antes de concluir a homologação. Não adicionar o ID de uma conta real ao repositório; a allowlist `LEVEL_PACKS_TEST_PLAYER_IDS` deve ser configurada somente em ambiente controlado, verificada com testes negativos para outros jogadores e não promovida acidentalmente para produção. Antes de um futuro rollout, atualizar conscientemente o teste `release-gates-default-off.test.js` somente após aprovar os gates.

## 2. GitHub Actions — booleanos do disparo, não variáveis do Environment

`.github/workflows/deploy-cloudflare.yml` só tem `workflow_dispatch`, não `push`. Os inputs `confirm_paid_plan` e `confirm_production` são checkboxes booleanas da tela **Actions → Deploy Clash of Izzy to Cloudflare → Run workflow**, não Environment Variables. O job só roda na `main` com ambas verdadeiras e usa o ambiente protegido `production`.

Não marcar essas confirmações antes de atestar o plano/budget no Dashboard Cloudflare, os checks da CI, o ponto de recuperação, os preços e a janela de lançamento. Sem confirmação o job é ignorado, não é um job de testes seguro por si só.

A inspeção inicial sem escrita já existe em **Actions → Cloudflare Paid Readiness (read-only)**, workflow `.github/workflows/cloudflare-paid-readiness.yml`. Escolher `target_branch=main` e deixar a confirmação de Paid desmarcada caso o plano ainda não tenha sido verificado. Esse workflow consulta acesso à conta, metadados, migrações e Time Travel sem aplicar migrações nem publicar Worker; requer GitHub Secrets válidos. O resultado não equivale a ensaio de recuperação.

## 3. D1 — leitura e restauração

Com credenciais autorizadas, somente para leitura:

```bash
npx wrangler --config wrangler.jsonc d1 info clash-of-izzy-db --json
npx wrangler --config wrangler.jsonc d1 time-travel info clash-of-izzy-db --json
npx wrangler --config wrangler.jsonc d1 migrations list clash-of-izzy-db --remote
```

Um bookmark atual significa que há um ponto consultável, **não** comprova uma restauração bem-sucedida nem altera o prazo de retenção. O restore sobrescreve o banco de produção e só pode ser considerado mediante autorização explícita, janela de manutenção e avaliação das escritas posteriores ao bookmark. Verificar o backend D1 no campo `version`; a documentação atual da Cloudflare identifica `production` para o novo sistema e `alpha` para o legado.

Desde 12/11/2026, a API D1 aceita exportar FTS5 com `dump_options.compatibility="sqlite3_cli_only"`, mas esse dump não pode ser importado de volta para o D1. O pipeline de recuperação recomendado continua baseado em Time Travel. Não executar `d1 export` ou `d1 time-travel restore` manualmente como procedimento de pré-lançamento.

Documentação: https://developers.cloudflare.com/d1/reference/time-travel/ e https://developers.cloudflare.com/changelog/post/2026-11-12-d1-export-virtual-tables/

## 4. PRs empilhadas

No momento desta auditoria: `#223` base `main`, `#229` base branch de `#223`, `#233` base branch de `#229`, `#236` base branch de `#233`. As três últimas são Draft. Depois de integrar cada dependência, verificar a base da PR filha, ajustar a base para `main` quando apropriado, conferir cuidadosamente o diff para não duplicar commits e executar CI no novo SHA. A disponibilidade do botão `Update branch` não assegura correção de uma cadeia de PRs empilhadas. Não fazer merges apenas porque a CI antiga estava verde.

## 5. SQL de conferência — chaves internas vs. públicas

Em `players`, `id` é inteiro interno e `player_id` é identificador público textual. Em `kingdoms`, `player_id` referencia `players.id`. Na migração 0042, `level_pack_claims.request_id` referencia **`purchase_requests.id`**, e não o identificador da Order do Mercado Pago.

Após executar o teste **em D1 Preview isolado**, consulte o saldo do jogador de teste com:

```sql
SELECT p.id AS internal_player_id, p.player_id AS public_player_id,
       p.gems, k.id AS kingdom_id, k.wood, k.food, k.stone, k.iron, k.gold
FROM players p JOIN kingdoms k ON k.player_id = p.id
WHERE p.player_id = 'PUBLIC_PLAYER_ID_DE_TESTE';
```

E, somente quando 0042 estiver aplicada:

```sql
SELECT r.id AS internal_request_id, r.mp_order_id, r.status,
       c.kingdom_id, c.pack_level, c.granted_at
FROM purchase_requests r
JOIN players p ON p.id = r.player_id
LEFT JOIN level_pack_claims c ON c.request_id = r.id
WHERE p.player_id = 'PUBLIC_PLAYER_ID_DE_TESTE'
  AND r.mp_order_id = 'MP_ORDER_ID_DE_TESTE';
```

Use identificadores sintéticos e mantenha resultados privados. A evidência requer verificar o estado aprovado no provedor, autenticidade do webhook, integridade da entrega e ausência de crédito em replays, transações recusadas e pedidos duplicados; uma linha em `level_pack_claims` sozinha não prova atomicidade.

## 6. Critérios antes de qualquer GO

- Revisar a issue #234 e cada PR/CI atualizada; confirmar também o catálogo e a migração 0043 da #236.
- Obter auditoria autenticada read-only de produção e Preview; validar o ponto de restauração e o plano de recuperação.
- Aplicar e testar 0037–0043 **somente em D1 Preview isolado** antes de agendar a migração protegida de produção.
- Homologar um pagamento P1 de R$ 9,90 com credenciais **Sandbox**, webhook e saldo no Preview. Nunca colocar credenciais ou pagamentos de Sandbox misturados ao Worker comercial.
- Validar APK **release assinado** em Android físico, inclusive atualização, touch, WebGL fallback e retomada; não prometer `< 3 segundos` sem métricas.
- Aprovar os preços P4–P8 antes de permitir vendas; obter GO registrado e janela protegida. Liberar público somente depois de canary documentado.

Referência de bloqueios: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/issues/234
