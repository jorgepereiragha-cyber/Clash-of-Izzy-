# Centro de comando do reino — Clash of Izzy

## Objetivo
Concentrar os comandos de administração do reino em uma interface mobile-first, inspirada na clareza de navegação de jogos de estratégia de reinos como Clash of Kings, mas com marca, textos e composição visual próprios.

## Estrutura de navegação entregue
- Reino: edifícios e melhorias.
- Exército: treinamento e batalha PvE.
- Ciência: linhas de pesquisa existentes.
- Mundo: territórios, marchas de coleta, exploração e ataque PvE a territórios neutros.
- Heróis e dragão: invocação/evolução de heróis e evolução do dragão quando existir registro.
- Aliança: criar/entrar, chat persistido e declaração de guerra entre alianças quando as permissões permitirem.
- Eventos: vitrine dos eventos planejados, claramente identificados como não ativos.

## Integração técnica
- Reutiliza o token `coi_game_token` já compartilhado com a arena.
- Usa `GET /api/game/state`, `POST /api/game/start` e `POST /api/game/action`.
- O servidor continua sendo a autoridade para saldo, custo, limites, permissões, tropas, batalhas e recompensas.
- Nenhuma tabela ou migração nova foi necessária.
- A entrada principal agora leva ao centro de comando; a arena permanece acessível pelo botão próprio.
- A arena ganhou um atalho de retorno ao centro de comando.

## Comandos conectados ao backend atual
`upgrade`, `train`, `research`, `march`, `battle`, `hero_summon`, `hero_evolve`, `dragon_upgrade`, `alliance_create`, `alliance_join`, `alliance_chat`, `alliance_war_declare`.

## Limitações explicitamente preservadas
- Melhorias e treinamento são imediatos no backend atual; não foi criada uma fila de construção ou treinamento falsa.
- O chat atual é persistido em D1 e o painel atualiza por recarga manual; WebSocket/Durable Objects ainda precisam ser implementados.
- O backend ainda limita ataques a territórios neutros; PvP entre reinos não foi simulado nem anunciado como ativo.
- Não há sistema de rally/ataque coordenado, calendário global de eventos, missões diárias ou notificações push nesta entrega.
- A aba Eventos é apenas um roteiro visual e não concede recompensas.
- A loja continua na arena; não foi duplicada.

## Referências de design e tecnologia
- Clash of Kings — atualizações oficiais listam otimizações de marcha, eventos, recursos de aliança, batalhas de aliança e organização de interface: https://apps.apple.com/us/app/clash-of-kings-cok/id945274928
- Clash of Kings — visão geral de ciência e benefícios de aliança (referência comunitária): https://clash-of-kings.fandom.com/wiki/Alliance_Science
- Cloudflare Durable Objects — WebSockets com hibernação para chat e salas: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare — servidor WebSocket com hibernação: https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- Three.js — design responsivo e limite de resolução em aparelhos móveis: https://threejs.org/manual/pages/responsive.html

## Segurança e publicação
- Nenhuma migração foi adicionada ou aplicada.
- Nenhum segredo, token ou dado de jogador foi lido ou gravado.
- Nenhuma alteração foi publicada em produção.
- O PR deve passar pelo CI existente (Node 22, testes de combate e validação do bundle do Worker) antes de ser considerado pronto para merge.
