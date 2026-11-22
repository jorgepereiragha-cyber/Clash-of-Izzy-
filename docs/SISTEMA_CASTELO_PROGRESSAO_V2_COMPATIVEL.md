# Integração segura — Castelo e Progressão v2 (22/11/2026)

## Auditoria do sistema existente
O jogo já tem grid 50x50, `kingdom_buildings` com uma instância por tipo, filas atômicas `kingdom_queues`, produção passiva por `kingdoms`, castelo até nível 30 e VIP 1–7 por `kingdoms.prestige`. Recriar `castle`, `city_buildings`, `players` ou `player_skins` conforme o documento enviado quebraria o esquema atual. Não execute o SQL recebido em produção.

## Implementado nesta proposta
- Quatro estágios geométricos de castelo procedurais: madeira (1–5), pedra (6–10), real (11–20), cidadela (21–30). Visual independentemente de GLBs inexistentes.
- P1–P8, níveis 1–80: XP acumulado em nova tabela aditiva `kingdom_player_progression`, calculado apenas a partir da conclusão de filas persistentes.
- XP atômico guardado pelo token de conclusão da fila, com o mesmo `DB.batch` da concessão de tropas/edifícios.
- Estado do reino e UI exibem as duas progressões sem autorizar XP vindo do cliente.
- **Não altera** gemas, VIP, saldos ou pagamentos.

## Dependências e trabalho posterior
- Aplicar `0040_kingdom_player_progression.sql` em D1 Preview **antes** de executar Worker alterado. O banco de produção permanece intacto até homologação.
- PR #223 já usa migrações 0037–0039 e altera `worker.js` / `kingdom.html`; revisar conflitos e ordem de merge.
- Cadeia de trigo→farinha→comida, sistema de trabalhadores, felicidade, posicionamento de torres e livre colocação múltipla exigem migrações próprias e transações; o esquema atual tem `UNIQUE(kingdom_id, building_type)`.
- Recompensas de fase, títulos, skins e buffs não são concedidos aqui: a proposta de até 20 milhões de gemas requer revisão da economia e idempotência.
- Os XP de filas históricas não são retrocreditados para evitar duplicações.
- Testar `npm test`, `npm run check`, `npm run db:migrate:local`, Preview D1, duas filas em paralelo, reabertura do aplicativo e FPS em Android real antes do merge/deploy.
