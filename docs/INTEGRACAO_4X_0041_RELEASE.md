# Clash of Izzy — Implantação protegida da expansão 4X (migração 0041)

## Fonte de verdade

- Worker único: `worker.js`, binding D1 `DB`, `wrangler.jsonc`.
- Grid canônico: `kingdom_buildings.position_x / position_z`, `city-layout-rules.js`.
- D1 progressivo: migrar a partir de 0040, sem alterar ou renumerar as migrações legadas.
- O castelo e seu VIP legado (`kingdoms.castle_level`, `kingdoms.prestige`) não são redefinidos.
- P1–P8 é uma trilha de XP independente, sem multiplicadores de ataque/defesa/produção.

## Ativação em duas fases

O Worker interpreta `GAME_4X_SYSTEMS_ENABLED === "true"` como habilitado. Não existe esse valor em `wrangler.jsonc` por padrão. Assim, novas consultas e ações não dependem da migração 0041 enquanto a flag permanecer ausente/desabilitada. **Não habilitar antes de migrar**.

1. Revisar PR #223 e a PR desta expansão, conferir CI verde para o SHA exato.
2. Comparar a tabela `d1_migrations` nos bancos D1 Preview e produção e verificar se a sequência 0037–0041 não tem versões ausentes/repetidas. Nunca recriar 0001..0040 ou renomear arquivos aplicados.
3. Aplicar o schema local: `npm run db:migrate:local` e `npm run db:migrate:preview:local`; executar `npm test` e `npm run check`.
4. Após backup e aprovação para operação remota, aplicar **primeiro no D1 Preview isolado**: `npm run db:migrate:preview:remote`. Não direcionar essa operação para o D1 de produção.
5. No Preview, ativar a flag no ambiente de teste e validar jornadas abaixo.
6. Validar pagamentos reais apenas por checkout sandbox/homologação autorizada; a expansão não modifica o Mercado Pago.
7. Antes de produção, fazer backup do banco e confirmar o estado de migrações. Aplicar 0041 por workflow protegido; ativar a flag somente após verificação de tabelas e índices. Não há drop/rollback de tabela: para rollback operacional, desabilitar a flag e retornar ao build anterior, preservando registros novos.

## Verificação read-only do schema

Executar no ambiente correto com `wrangler d1 execute`:
```sql
SELECT name FROM sqlite_master
WHERE type='table' AND name IN (
 'intermediate_resources','city_defenses','kingdom_progression','progression_xp_ledger'
) ORDER BY name;
PRAGMA table_info(intermediate_resources);
PRAGMA table_info(city_defenses);
PRAGMA table_info(kingdom_progression);
```

O schema 0041 **não cria colunas de grid em `kingdom_buildings`**. A persistência antiga é preservada; a tabela de defesas usa coordenadas próprias para permitir múltiplas defesas de cada tipo.

## Homologação: cenários sem tocar em produção

1. Crie um jogador no D1 Preview. Confirme que sem flag continua a produção legada; nenhum endpoint 4X é executado.
2. Habilite a flag no Worker Preview após aplicar as migrações. Confira que o primeiro tick cria `intermediate_resources` sem debitar saldos.
3. Com 1h simulada de produção: fazenda nível 1, moinho nível 1 e padaria nível 1 devem converter 12 trigo → 12 farinha → 12 comida. Dois ticks concorrentes não podem duplicar a comida ou o ledger.
4. Fazenda acima do moinho: o excesso deve ser armazenado em trigo; moinho acima da padaria: o excesso deve ser armazenado em farinha. Nunca consumir matéria-prima se o armazém de comida está cheio.
5. Validar limites e custos de defesa no servidor, inclusive para um jogador sem castelo mínimo. Posicionar uma torre e tentar outra defesa no mesmo espaço; a segunda ação deve retornar 409 e não debitar recursos. Confirmar também a rejeição de deslocar um edifício sobre uma defesa.
6. Conferir a apresentação das defesas em Three.js e no mapa 2D em Android, inclusive perda de contexto WebGL, redimensionamento e status de rede.
7. Concluir uma fila legítima de construção, pesquisa e treino; conferir `progression_xp_ledger` e que repetir a conclusão da mesma fila não duplica XP. Validar limites de XP em níveis 10/11, 20/21 e 79/80.
8. Conferir VIP 1–7, login, onboarding, recompensas diárias, PWA offline, deploy de portal isolado, webhook e status de pagamento, sem alterações regressivas.

## Gaps de release ainda bloqueantes

A CI testa sintaxe, contrato e migrações locais. **Ela não substitui** auditoria do estado real do D1 remoto, pagamentos sandbox, validação concorrente no Preview nem teste do APK em dispositivo Android real.
