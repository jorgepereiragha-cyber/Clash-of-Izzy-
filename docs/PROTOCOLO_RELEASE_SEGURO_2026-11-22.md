# Clash of Izzy — protocolo verificado de release (22/11/2026)

Estado: **NO-GO comercial**. Este documento não autoriza merge, deploy, migração, pagamentos ou restauração do D1.

## 1. Flags do Worker — não confundir strings e booleanos

A PR #240 foi integrada à `main` no commit `07026b6ef92a44b266b3ee2f9eb2cf60061a41d7` e definiu os seguintes valores explícitos em `wrangler.jsonc` como **strings**:
`GAME_4X_SYSTEMS_ENABLED="false"`,
`LEVEL_PACKS_ENABLED="false"`,
`LEVEL_PACKS_PUBLIC_ENABLED="false"` e
`LEVEL_PACKS_PROPOSED_PRICES_APPROVED="false"`.
O valor existente `ENVIRONMENT="production"` foi preservado.

A branch de feature `level-packs.js` compara com `=== "true"`. Nunca ativar as flags na `main` antes de concluir a homologação. Não adicionar o ID de uma conta real ao repositório; a allowlist `LEVEL_PACKS_TEST_PLAYER_IDS` deve ser configurada somente em ambiente controlado, verificada com testes negativos para outros jogadores e não promovida acidentalmente para produção. Antes de um futuro rollout, atualizar conscientemente o teste `release-gates-default-off.test.js` somente após aprovar os gates.

## 2. GitHub Actions — booleanos do disparo, não variáveis do Environment

`.github/workflows/deploy-cloudflare.yml` só tem `workflow_dispatch`, não `push`. Os inputs `confirm_paid_plan` e `confirm_production` são checkboxes booleanas da tela **Actions → Deploy Clash of Izzy to Cloudflare → Run workflow**, não Environment Variables. O job só roda na `main` com ambas verdadeiras e usa o ambiente protegido `production`.

Não marcar essas confirmações antes de atestar o plano/budget no Dashboard Cloudflare, os checks da CI, o ponto de recuperação, os preços e a janela de lançamento. Sem confirmação o job é ignorado, não é um job de testes seguro por si só.

**Erro operacional concreto:** marcar `confirm_paid_plan=true` e deixar `confirm_production=false` **NÃO** implanta uma versão desativada. O job inteiro é ignorado; não há backup, migração ou deploy. O único caminho de auditoria sem mudanças é o workflow `Cloudflare Paid Readiness (read-only)`.

**Publicação promocional:** o workflow `publicar-portal-cloudflare.yml` anteriormente usava `workflow_run` e podia publicar automaticamente o Worker promocional após CI verde na `main`. Para as integrações 4X, também deve exigir `workflow_dispatch` na `main`, input booleano `confirm_portal_publish=true` e ambiente `production`. A publicação promocional não atualiza D1, mas deve obedecer à mesma disciplina de autorização. Não confundir o fluxo de portal com o deploy principal do jogo.

**Disparos indiretos:** o repositório antes continha `liberar-eldoria-prod-apos-ci.yml` e `publicar-visual-real-apos-ci.yml` com gatilho `workflow_run` que podia solicitar deploy após CI bem-sucedida com marcador de commit. A PR #240 aposenta esses dois bridges e remove suas permissões de escrita em Actions. Seus workflows legados continuam acessíveis, mas apenas para informar a desativação, sem chamar `deploy-cloudflare.yml`. O fluxo manual antigo `primeiro-lancamento-clash-izzy.yml` permanece separado e não é um mecanismo de homologação 4X.

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

No momento desta auditoria: `#223` base `main`, `#229` base branch de `#223`, `#233` base branch de `#229`, `#236` base branch de `#233`. As três últimas são Draft. Há ainda outras branches Draft (#237 para a assinatura Android e #238 para preços/migração 0043) que requerem análise de conflitos e eventual integração controlada, sem assumir que todo o trabalho está nas quatro PRs principais. Depois de integrar cada dependência, verificar a base da PR filha, ajustar a base para `main` quando apropriado, conferir cuidadosamente o diff para não duplicar commits e executar CI no novo SHA. A disponibilidade do botão `Update branch` não assegura correção de uma cadeia de PRs empilhadas. Não fazer merges apenas porque a CI antiga estava verde.

## 5. SQL de conferência — chaves internas vs. públicas

**Atualização operacional:** A consulta completa para uma Order específica, com verificação das colunas reais de `mercadopago_orders` e `purchase_requests`, está em [`docs/4X_SANDBOX_CHECK_SQL.md`](4X_SANDBOX_CHECK_SQL.md). A coluna `mp_payment_status` pertence a `purchase_requests`, e não a `mercadopago_orders`. Não se espera automaticamente uma linha por jogador: é obrigatório filtrar um pedido específico.

**Desenvolvimento local:** `npm run dev` e `wrangler dev` usam D1 local por padrão, mesmo que a configuração mencione a identidade do banco de produção. Isso não equivale a rodar contra o D1 Preview remoto, nem ativa por si só credenciais Sandbox do Mercado Pago. Nunca executar `dev --remote` sem revisar previamente todas as bindings e segredos. O workflow de migração de Preview é separado, exige UUID e confirmação de que o banco é descartável e só permite branches aprovadas. A presença do esquema Preview não prova o fluxo real de pagamento.


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

**Consulta incorreta (não executar):** `WHERE p.id = 'ID_PUBLICO_DO_JOGADOR'`. `p.id` é inteiro, portanto a pesquisa correta compara o ID público com `p.player_id`. O relacionamento de pagamento é `level_pack_claims.request_id = purchase_requests.id`, enquanto `purchase_requests.mp_order_id` é a referência externa da Order.

Use identificadores sintéticos e mantenha resultados privados. A evidência requer verificar o estado aprovado no provedor, autenticidade do webhook, integridade da entrega e ausência de crédito em replays, transações recusadas e pedidos duplicados; uma linha em `level_pack_claims` sozinha não prova atomicidade.

## 6. Etapas separadas para Preview, produção e publicidade

**Fase A — auditoria:** executar apenas `Cloudflare Paid Readiness (read-only)` com `target_branch=main`, sem marcar Paid se não comprovado. Registrar metadados, `d1_migrations` e Time Travel; não inferir que há restore testado.

**Fase B — homologação isolada:** validar migrações em Preview descartável autorizado e realizar pagamento do Mercado Pago Sandbox **somente no ambiente isolado com credenciais de teste**. Não usar o Worker público com credenciais reais para simular Sandbox. Verificar sessão, status via API do provedor, webhook, ledger, saldos anteriores/depois, retries, estornos e ausência de crédito indevido.

**Fase C — integração:** com evidências da Fase B e CI aprovada no SHA exato, revisar/retarget as PRs e os conflitos. Preservar flags comerciais desligadas e aprovar a janela para `deploy-cloudflare.yml`. Nessa execução, **ambos os inputs booleanos precisam estar verdadeiros**, caso contrário o job será ignorado. O pipeline captura bookmark e migra remotamente; mudanças no D1 exigem janela e plano de reversão.

**Fase D — liberação comercial:** validar o Worker público, APK assinado no Android físico, preços P4–P8, testes de canary e métricas. `LEVEL_PACKS_PUBLIC_ENABLED` continuará `"false"` depois de um deploy com as flags de proteção; o workflow não a liga automaticamente. A abertura comercial exige mudança de configuração e novo deploy protegido, com aprovação explícita e reexecução dos gates. Não publicar anúncio de lançamento com base apenas em SQL ou CI verdes.

## 7. Critérios antes de qualquer GO

- Revisar a issue #234 e cada PR/CI atualizada; confirmar também o catálogo e a migração 0043 da #236.
- Obter auditoria autenticada read-only de produção e Preview; validar o ponto de restauração e o plano de recuperação.
- Aplicar e testar 0037–0043 **somente em D1 Preview isolado** antes de agendar a migração protegida de produção.
- Homologar um pagamento P1 de R$ 9,90 com credenciais **Sandbox**, webhook e saldo no Preview. Nunca colocar credenciais ou pagamentos de Sandbox misturados ao Worker comercial.
- Validar APK **release assinado** em Android físico, inclusive atualização, touch, WebGL fallback e retomada; não prometer desempenho inferior a 3 segundos sem métricas.
- Aprovar os preços P4–P8 antes de permitir vendas; obter GO registrado e janela protegida. Liberar público somente depois de canary documentado.

Referência de bloqueios: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/issues/234
