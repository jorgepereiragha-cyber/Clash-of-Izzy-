# Locais de recrutamento — integração segura

## Etapa já implementada nesta branch
A cidade oferece dois locais de entrada clicáveis, responsivos e navegáveis por teclado:
- **Altar de Convocação** abre `/equipment-ui.html#hero-summon-title`, reutilizando a convocação de 1 herói por 100 gemas ou 10 por 900 gemas, com sorteio no Worker.
- **Ninho de Dragões** abre `#coiDragonPanel`, reutilizando o desbloqueio e a coleção de dragões autenticados existentes.

A coleção passa a mostrar o **nível e o vínculo do dragão equipado** usando o estado retornado pelo Worker; esses valores são apenas leitura, sem botão fictício de alimentação.

São **entradas visuais no painel da cidade**, não construções persistidas nem footprints 3×3 no grid. Não exibem ovos/incubação inexistentes e não concedem dragões dourados.

## Por que a criação física ficou separada
`migrations/0002_world.sql` impõe `CHECK (building_type IN (...16 tipos...))` em `kingdom_buildings`. Alterar somente `CITY_FOOTPRINTS` deixa `city_layout_move`, SQL de colisão e inserções de construções inconsistentes. É incorreto realizar migração D1 remota enquanto se desenvolve essa feature.

## Requisitos para prédios reais (issue #261)
- Modelo novo **aditivo** para locais funcionais ou migração de tabela planejada e isolada, com dados legados preservados, sem duplicar o inventário.
- Posicionamento autoritativo no servidor: footprint 3×3, CAS, colisão com edifícios e defesas, reinos isolados, nenhuma movimentação sem registro do prédio.
- UI do editor 50×50 usando o estado do servidor; aplicação de migração em D1 local e depois Preview isolado antes da produção.
- Novo fluxo de ovos com custo, slots, raridade, incubação por relógio de servidor, reivindicação idempotente, limites e bloqueio explícito de dragões Master por rotas gratuitas.
- Alimentar/vínculo dos dragões somente com economia validada no servidor, deduplicação por `request_key`, teste de concorrência e preservação de `DRAGON_BONUS_CAP`.

## O que não foi alterado
`worker.js`, migrações, banco D1 remoto, pagamentos, probabilidades de invocação, resgates, saldos, buff de heróis, APIs, flags, distribuição Android e `main`.

## Validação
`node --test tests/recruitment-sites.test.js`, workflow CI e verificação visual em largura Android antes de mesclar.
