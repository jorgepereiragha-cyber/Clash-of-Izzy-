# Auditoria de prontidão — edição inicial no plano Cloudflare Gratuito

Data: 17 de novembro de 2026  
Branch de trabalho: `release/one-shared-realm-early-access`  
PR de lançamento: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/120

## Decisão de arquitetura do mundo

Eldoria é um único reino/servidor compartilhado por todos os jogadores. A tabela legada `kingdoms` descreve a cidade/castelo de cada jogador, não um mundo privado. A main auditada anteriormente dividia os castelos em `map_region` diferentes após 400 posições. A edição inicial remove essa divisão, mantém `map_region = 1`, amplia a grade global em 20 colunas e reposiciona os marcadores antigos na migration 0026. A consulta do mapa carrega somente os castelos próximos, sem dividir o servidor.

## Alterações aplicadas nesta branch

1. **Reino compartilhado:** novo módulo de coordenadas, migration `0026_single_shared_realm.sql`, consulta do mapa sem filtro por região e testes que cobrem até 10.000 posições, incluindo o 401º castelo.
2. **Edição de skins:** catálogo pago inicial limitado a seis entradas, sem apagar catálogo, inventários ou pedidos antigos.
3. **Carga do plano Gratuito:** Cron continua a cada minuto, mas processa lotes controlados: 3 filas globais, 1 grupo de reino/2 marchas no fallback global, 1 rally, 10 recompensas de evento por execução, 10 recompensas diárias de Valhalla por execução, 1 e-mail e limpeza em lotes.
4. **Chat eficiente:** nova rota autenticada `GET /api/game/alliance/chat` retorna somente a conversa da aliança; a arena não baixa mais o estado inteiro do reino a cada atualização. A frequência do chat passou a 15 segundos e a atualização das filas do reino a 60 segundos.
5. **Sessão do chat:** o token é lido primeiro de `localStorage` e depois de `sessionStorage`, sem ignorar o segundo quando o primeiro está vazio.
6. **Skins equipáveis:** migration `0027_castle_skin_equipment.sql`, ação autenticada `castle_skin_equip`, validação de propriedade em `player_skins`, seleção na cidade e loja, e aparência propagada aos castelos do mapa compartilhado.
7. **Testes adicionados:** coordenadas do mundo único, lotes do Cron, feed do chat, proteção administrativa e equipagem autorizada de skins.

## Limites reais a observar no plano Gratuito

A documentação oficial consultada em 17/11/2026 indica 100.000 requisições Workers por dia, 10 ms de CPU por chamada HTTP e por Cron, e 50 subrequisições por invocação. No D1 Gratuito há 5 milhões de linhas lidas/dia, 100 mil linhas escritas/dia, 500 MB por banco e 5 GB de armazenamento total da conta. Uma chamada `db.batch()` conta como uma subrequisição D1, mas todas as linhas lidas/escritas continuam sujeitas às quotas.

A redução de lotes e chamadas de chat ajuda a respeitar esses limites, mas ainda não existe medição de CPU e subrequisições D1 do endpoint completo `/api/game/state` no runtime remoto. Portanto, não há um número tecnicamente comprovado de jogadores simultâneos. O benchmark deve ser executado apenas em Preview/staging descartável.

## Pendências obrigatórias antes de cobrar/publicar

- **CI #1021 — sucesso no HEAD `a76fe5d18e927eaf251c6b425b4467c5e3d20d46`:** 274/274 testes Node, migrations D1 locais no perfil de produção e no Preview isolado, Worker+D1, validação do Service Worker e dos 5 assets GLB habilitados, e 3/3 cenários Playwright móveis (Pixel 5 emulado e viewport de 360 CSS px). O Wrangler `deploy --dry-run` passou com 354,61 KiB / 77,00 KiB gzip. O Workers Build do Preview da branch também passou; isso não comprova o D1 remoto ou o gameplay autenticado no Preview. [CI #1021](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44157977051).
- Segurança administrativa: PR #116 foi integrada à `main` no commit `d94849fa38617dc8668cf8ab2dfed88984c094ab` após CI #941 verde. A CI #991 verificou a barreira por smoke read-only no Worker público, com `adminHealthAuthBoundary: true`.
- **D1 de Preview preparado, ainda não validado remotamente:** `wrangler.jsonc` declara `previews.d1_databases` com binding `DB` para `izzy-preview-17112026` (`6674c0ac-3636-4e57-bff8-23cf60ab9637`). `wrangler.preview-migrations.jsonc` usa o mesmo ID com binding `PREVIEW_DB`; a CI valida as migrations localmente nesse perfil. Esse ID foi reaproveitado da configuração de staging proposta na PR #112, mas sua existência e acessibilidade na conta Cloudflare ainda não foram comprovadas. Antes de qualquer migração remota, confirmar que o D1 existe e é descartável. Não alterar o binding de produção (`7e63af59-d9ff-4159-a9cf-b02e35b92605`). Dois Previews com o mesmo ID D1 compartilham os dados; Version URLs usam recursos de produção e não servem como isolamento.
- Vendas manuais: pedido de pacote/skin é registrado com método `manual`, abre o WhatsApp comercial `5547996531437` com os dados do pedido e aguarda conferência externa. O Master libera no painel pelo botão `✓ Liberar pacote`; não há novo checkout Mercado Pago nesta edição; o webhook legado só atende ordens criadas antes do fluxo manual.
- Skins: equipagem/retirada e visualização foram implementadas e passaram na CI #991. As seis skins usam paletas de materiais/cores na geometria de castelo existente, não seis malhas 3D distintas. A PR #120 continua aberta; a função ainda não está publicada.
- Android físico: testar cidade/mapa 3D, toque, PWA standalone, retomada de sessão, cache e consumo de memória.
- Capacidade: medir CPU real, consultas D1 por `/api/game/state`, linhas lidas/escritas e backlog do Cron em staging antes de fixar limite público de jogadores.

## Preservação

A correção de segurança da PR #116 está integrada na `main`; o smoke read-only da CI #972 reportou a barreira administrativa ativa no Worker público. Nenhum deploy de skins ou migration remota foi iniciado; nenhum banco, token, secret, conta, progresso, tropas, compras ou inventário foi apagado. A branch e a PR permanecem como proposta revisável até os gates acima passarem.

## Sequência de lançamento

1. Concluir CI/revisão da nova PR de lançamento, já baseada na main com a segurança administrativa integrada.
2. Confirmar que o D1 de Preview configurado existe e é descartável; aplicar migrations 0001–0027 somente nele e validar migrations 0026/0027, autenticação, mapa, marchas, rallies, chat e equipagem.
3. Testar pedido manual WhatsApp e aprovação Master em D1 Preview descartável; confirmar pagamento fora do jogo antes de liberar.
4. Testar no Android físico e obter backup/bookmark de produção.
5. Executar workflow de deploy manual protegido após aprovação explícita.
6. Fazer smoke test público somente de leitura e validar o pedido/aprovação em staging. Qualquer pagamento real deve ser combinado e confirmado manualmente pelo proprietário.

**Conclusão:** a arquitetura de reino compartilhado e o perfil inicial de cargas gratuitas estão implementados na branch. O jogo ainda não está liberado para produção por esta alteração; a maior parte dos próximos bloqueios é validação remota, segurança e garantia de que os itens vendidos são utilizáveis.

## Atualização de referência técnica — 17/11/2026

- Workers Free: 100.000 requisições/dia, 10 ms de CPU por invocação HTTP/Cron e 50 subrequisições por requisição ([limites oficiais](https://developers.cloudflare.com/workers/platform/limits/)).
- D1 Free: 5 milhões de linhas lidas/dia, 100 mil escritas/dia; 500 MB por banco, 5 GB total e 50 subconsultas por invocação ([preço](https://developers.cloudflare.com/d1/platform/pricing/) · [limites](https://developers.cloudflare.com/d1/platform/limits/)). Os limites diários de linhas são aplicados e as queries falham até o reset se forem excedidos ([aviso oficial](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)).
- Previews precisam de D1 de staging separado; IDs iguais compartilham dados. Version URLs usam recursos de produção ([isolamento](https://developers.cloudflare.com/workers/previews/resources/) · [comparação de fluxos](https://developers.cloudflare.com/workers/previews/compare-workflows/)).
- Cron Triggers não geram execuções agendadas em Previews; o teste do agendador deve usar Worker-D1 local ou rotina de teste protegida. Não considerar o Preview como validação automática do Cron.
## Otimização adicional de D1 — 17/11/2026

- `gameState` agrupa 15 instruções de leitura do estado (incluindo skins próprias) em um único `D1 batch()`; convites/aliança e detalhes (membros, chat, convites e guerras) também usam batches próprios.
- Recalculo de capacidade/defesa e poder agrupa leituras independentes. Loja, cosméticos, sincronização de heróis e estado de mascotes também agrupam as leituras.
- A CI #1021 executou os testes Worker+D1 e a validação de migrations local do D1 Preview. O smoke read-only da produção continuou acusando a loja antiga sem fluxo manual WhatsApp; como a etapa é informativa (`continue-on-error`), a CI de qualidade permanece verde. Isso confirma que a mudança ainda não foi publicada.
- A otimização reduz subconsultas por invocação, mas não substitui medição no D1 Preview: leituras/escritas continuam consumindo a quota diária e o teto de CPU de 10 ms continua sendo aplicado.