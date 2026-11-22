# Clash of Izzy: abertura progressiva de três mapas

Política aprovada: Mapa 1 aberto desde o lançamento; Mapa 2 desbloqueado após 700 reinos persistentes; Mapa 3 após 1.000 reinos persistentes. Contam-se reinos únicos no banco D1, NÃO conexões simultâneas.

## Funcionamento
- Mapa 1 (Eldoria Origem): entra até o 700º novo jogador, se o banco estava vazio.
- Mapa 2 (Eldoria Fronteira): abre quando são registrados 700 reinos. Novos reinos a partir do 701º entram neste mapa.
- Mapa 3 (Eldoria Ascensão): abre aos 1.000 reinos. Novos reinos a partir do 1.001º entram neste mapa.
- O desbloqueio é persistente e não se fecha se a população cair.
- Se o banco já tiver 700 ou 1.000 reinos ao aplicar a migration, os mapas correspondentes abrem imediatamente.
- Todos os jogadores antigos permanecem no mapa 1 sem perder posições, tropas, castelo, heróis, itens ou compras. Nenhum teletransporte forçado.
- O campo map_region identifica cada mapa. Os territórios exibidos e as marchas são filtrados pela região no Worker. O navegador não tem permissão de trocar o mapa de um jogador.
- GET /api/realms/status mostra contagem total e progresso sem expor dados pessoais; o painel em world.html mostra abertos/bloqueados.
- Recursos neutros são replicados em cada mapa com chaves distintas. Índices exclusivos protegem as posições dentro de cada mapa.

## Segurança e implantação
1. A migration 0034_progressive_realms.sql cria map_slot, realm_openings e world_territories.map_region sem excluir jogadores. Fazer backup D1 Time Travel antes de migrar.
2. A criação de reino reserva região e slot na mesma escrita no SQLite, seguida do registro de abertura dos novos mapas.
3. O health passa a exigir realm_openings; a auditoria pré-migração protegida aceita a tabela pendente somente quando todas as demais verificações estiverem íntegras. Health pós-deploy não aceita tabelas faltando.
4. Validar em D1 Preview: novos jogadores 699/700/701 e 999/1000/1001, recuperação de reino legado, não duplicar castelos, não atravessar mapas em ações de marcha e aliança.
5. CI aprovada, deploy protegido, verificação remota, teste em Android físico e publicação de APK assinado com SHA-256 são etapas separadas.

## Escalabilidade real
Mapas lógicos separados NÃO são três servidores físicos independentes. Workers, D1 e salas de presença continuam compartilhados. Os oito shards de presença dão apenas um teto teórico e não demonstram suporte a 1.000 jogadores simultâneos. Medir carga, custo, latência e antiabuso antes de investir em novos servidores físicos e campanhas amplas.

## Implementação
- realm-progression.js: limites, coordenadas e estado agregado.
- migrations/0034_progressive_realms.sql: schema durável.
- worker.js: criação de reinos, API, segregação e proteção de ações.
- world.html e world-map.js: estado de abertura e progresso.
- scripts/cloudflare-remote-audit.mjs e deploy-cloudflare.yml: preflight estrito.
- tests/progressive-realms.test.js: limites e contratos.

Este documento não declara implantação remota nem publicação Android efetuadas.
