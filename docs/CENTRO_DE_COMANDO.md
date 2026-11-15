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
- Eventos: missões diárias com progresso real e resgate único no servidor; calendário de modos sazonais planejados, explicitamente separados dos eventos ativos.

## Integração técnica
- Reutiliza o token `coi_game_token` já compartilhado com a arena.
- Usa `GET /api/game/state`, `POST /api/game/start` e `POST /api/game/action`.
- O servidor continua sendo a autoridade para saldo, custo, limites, permissões, tropas, batalhas e recompensas.
- A migração `0008_liveops_daily_claims.sql` registra os resgates diários com chave única por reino, dia UTC e missão, marca o crédito confirmado e adiciona índices para as consultas de progresso. Cada prêmio também gera lançamento no `resource_ledger` dentro do mesmo lote D1.
- A entrada principal agora leva ao centro de comando; a arena permanece acessível pelo botão próprio.
- A arena ganhou um atalho de retorno ao centro de comando.

## Comandos conectados ao backend atual
`upgrade`, `train`, `research`, `march`, `battle`, `hero_summon`, `hero_evolve`, `dragon_upgrade`, `alliance_create`, `alliance_join`, `alliance_chat`, `alliance_war_declare`.

## Limitações explicitamente preservadas
- Melhorias e treinamento são imediatos no backend atual; não foi criada uma fila de construção ou treinamento falsa.
- O chat atual é persistido em D1 e o painel atualiza por recarga manual; WebSocket/Durable Objects ainda precisam ser implementados.
- O backend ainda limita ataques a territórios neutros; PvP entre reinos não foi simulado nem anunciado como ativo.
- Missões diárias ativas: treinar 20 tropas, melhorar um edifício, concluir uma pesquisa e participar de uma batalha PvE. Progresso é derivado dos registros autoritativos existentes; recompensas são creditadas pelo servidor, registradas no ledger e cada missão só pode ser resgatada uma vez por dia UTC. O painel mostra o próximo reinício no horário local e em UTC.
- Ainda não há rally/ataque coordenado, calendário global automatizado, chefe mundial, torneio sazonal competitivo ou notificações push.
- A aba Eventos separa missões diárias ativas do roteiro de eventos futuros; apenas as missões diárias entregam recompensas nesta fase.
- A loja continua na arena; não foi duplicada.

## Referências de design e tecnologia
- Clash of Kings — atualizações oficiais listam otimizações de marcha, eventos, recursos de aliança, batalhas de aliança e organização de interface: https://apps.apple.com/us/app/clash-of-kings-cok/id945274928
- Clash of Kings — visão geral de ciência e benefícios de aliança (referência comunitária): https://clash-of-kings.fandom.com/wiki/Alliance_Science
- Cloudflare Durable Objects — WebSockets com hibernação para chat e salas: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare — servidor WebSocket com hibernação: https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
- Three.js — design responsivo e limite de resolução em aparelhos móveis: https://threejs.org/manual/pages/responsive.html

## Referências adicionais de LiveOps
- Rise of Kingdoms — calendário e variedade de eventos de aniversário, quiz de aliança, treinamento de armas e expedições: https://apps.apple.com/ca/app/rise-of-kingdoms/id1354260888
- Whiteout Survival — Alliance Showdown e Tundra Trade Route: https://apps.apple.com/gb/app/whiteout-survival/id6443575749
- Clash of Kings — Strongest Kingdom, Monster Culling, eventos de chefe e ajustes de etapas: https://apps.apple.com/us/app/clash-of-kings-cok/id945274928
- Cloudflare Durable Objects — coordenação de salas, estado persistente e agendamento: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/

## Melhorias incorporadas da pesquisa de eventos 2026
- A tela de missões informa o reinício tanto no horário local quanto em UTC, reduzindo confusão de fuso.
- O catálogo de design prevê janelas de sessão, limites de tentativas, lista de participantes, avisos fixados, canal de liderança e tutoriais curtos na primeira participação.
- Eventos futuros devem ser liberados por regras configuráveis de idade do reino e temporada, com matchmaking por faixa de poder.

## Segurança e publicação
- A migração `0008_liveops_daily_claims.sql` foi adicionada à branch, mas ainda não foi aplicada ao D1 remoto.
- Nenhum segredo, token ou dado de jogador foi lido ou gravado.
- Nenhuma alteração foi publicada em produção.
- O PR deve passar pelo CI existente (Node 22, testes de combate e validação do bundle do Worker) antes de ser considerado pronto para merge.
