# LiveOps e arquitetura de eventos — Clash of Izzy

## Princípios
1. O servidor é a única autoridade de calendário, pontuação, elegibilidade, sorteio, saldo e recompensa.
2. Toda missão e recompensa tem chave idempotente; uma repetição de requisição nunca duplica prêmio.
3. Eventos têm começo, fim, fuso explícito (UTC), período de preparação quando necessário e aviso de encerramento.
4. Jogadores gratuitos conseguem concluir a trilha-base e obter recompensas úteis. Pagamento pode acelerar conveniência ou comprar cosméticos, mas não deve comprar posição competitiva.
5. Matchmaking considera idade do reino, atividade e faixa de poder; não compara novatos com reinos veteranos.
6. Limitar eventos simultâneos e oferecer tarefas alternativas para reduzir fadiga e pressão de login.

## Sistemas observados em jogos de referência
- **Clash of Kings:** tarefas por etapas, eventos de pontuação e ranking, chefes de aliança, caça a monstros, temporadas e competições entre reinos; alterações oficiais também mostram a importância de remover ou ajustar eventos que deixam de funcionar.
- **Rise of Kingdoms:** calendário de eventos, eventos de aniversário em série, quiz de aliança, treinamento progressivo, expedições, escolta de caravanas e competições por temporada.
- **Whiteout Survival:** disputas entre alianças, rotas de comércio/escolta, tarefas coletivas e comunicação de aliança. Atualizações oficiais de 2026 destacam ainda janelas de sessão, tentativas por evento, lista de participantes, canais de liderança, avisos fixados, lembretes, tutoriais de primeira participação e exibição de horários UTC/local.
- **Rise of Kingdoms:** eventos e recompensas podem variar pela idade/temporada do reino; algumas atividades só liberam após o reino atingir uma idade mínima. A pontuação e o matchmaking devem usar regras explícitas e limites para evitar que uma conta isolada distorça a classificação.
- **Cloudflare:** Workers para API stateless; D1 para estado persistente; Durable Objects particionados por sala/aliança para coordenação em tempo real; Cron para calendário global e alarmes para tarefas específicas. Não concentrar todo o jogo em um único Durable Object.

## Catálogo original de eventos

| Sistema | Ciclo sugerido | Mecânica | Recompensas |
|---|---|---|---|
| Missões diárias | Diário | Objetivos de construção, treino, pesquisa e PvE | Recursos, materiais e baú diário |
| Presença do Reino | Diário / 7 dias | Recompensa progressiva de login, com recuperação limitada | Recursos e fragmentos |
| Metas semanais | Semanal | Metas individuais acumuladas, com objetivos alternativos | Aceleradores básicos e materiais |
| Desafio da Aliança | Semanal | Soma de contribuições válidas de membros; meta comunitária e marcos individuais | Moeda de aliança, baús e cosméticos |
| Chefe Ancestral | 2–3 dias | Tentativas limitadas, fases cooperativas e contribuição normalizada | Fragmentos dracônicos e materiais |
| Expedição dos Sete Tesouros | 5–7 dias | Grupo, rotas com escolhas, exploração e objetivos compartilhados | Relíquias, recursos e cosméticos |
| Caravana Real | 2–3 dias | Escolta PvE com emboscadas e decisões de rota | Recursos e fichas de evento |
| Torneio das Alianças | 7 dias | Rodadas com missões de objetivo, defesa e cooperação | Emblemas, molduras e troféus |
| Guerra dos Reinos | Sazonal | Preparação, disputa e recuperação; matchmaking por faixa | Recompensas por participação e desempenho |
| Festival do Reino | Sazonal | Minijogos leves, coleção e loja temporária | Skins, decoração e itens não exclusivos de poder |
| Retorno do Comandante | Após inatividade | Trilha curta de reentrada e objetivos de recuperação | Recursos de retomada sem ultrapassar novatos ativos |

## Requisitos de produto extraídos da pesquisa recente
- Todo evento deve exibir: estado (preparação/inscrição/ativo/encerrado), horário UTC e local, duração, elegibilidade, limite de tentativas, participantes e regras de pontuação.
- Tutoriais curtos na primeira participação e filtros de participantes ajudam jogadores a entender a atividade sem depender de guias externos.
- Avisos fixados e canal de liderança reduzem perda de informação durante guerras e eventos cooperativos.
- Desbloqueio por idade do reino/temporada deve ser configurável no servidor; não codificar um limite universal de 21 dias para todos os modos.
- Pontuação diária agregada deve considerar o melhor resultado diário quando a regra do evento pedir isso, e não somar tentativas ilimitadas.

## Regras de justiça e segurança
- Não pontuar ações compradas diretamente com dinheiro; quando houver aceleração paga, pontuar apenas resultado de jogo válido e limitar a contribuição por categoria.
- Em rankings, usar faixas de poder e recompensas por marcos; não premiar apenas os 1% primeiros.
- Chefes e guerras usam tentativas, limites por jogador e normalização de força para evitar domínio absoluto por grandes gastadores.
- Recompensas de participação têm piso garantido; bônus de colocação são adicionais e não devem bloquear progressão essencial.
- Não permitir auto-ataques, múltiplas contas coordenadas ou repetição de eventos para farm infinito; validar cooldowns e limites no servidor.
- Registrar cada crédito em ledger e manter histórico de resgates, ranking congelado ao fim e trilha de auditoria.
- Mostrar regras, elegibilidade, horário UTC, recompensa e data de expiração antes da entrada.

## Cadência inicial recomendada
- Diário: missões leves e login.
- Segunda a domingo: meta semanal da aliança, com tarefas alternativas.
- Duas janelas de evento curto por semana, evitando competir com o horário de sono do jogador.
- Um evento cooperativo maior por ciclo de 2 semanas.
- Um grande evento sazonal por ciclo de 4–6 semanas, condicionado ao tamanho e à saúde da população do servidor.
- Máximo recomendado de dois eventos de alta exigência simultâneos.

## Roadmap de implementação
- **P0 — entregue nesta branch:** quatro missões diárias calculadas no servidor, resgate único por dia UTC, crédito auditável em `resource_ledger`, índices compostos para consultas de progresso e painel com horário local + UTC.
- **P1 — próxima:** calendário persistente, sequência de login, metas semanais e desafio de aliança com ranking e recompensas idempotentes.
- **P2:** chefe ancestral com fases, expedição cooperativa e caravana PvE.
- **P3:** torneio de alianças e guerra entre reinos com matchmaking, registro, fases e temporada.
- **P4:** ferramentas LiveOps administrativas, segmentação por idade do reino, configuração de calendário sem deploy e telemetria de equilíbrio.

## Métricas para acompanhar
- Participação por evento e por faixa de poder.
- Conclusão por etapa e abandono no meio do evento.
- Retenção D1/D7/D30 antes e depois do evento.
- Distribuição de recompensas, inflação de recursos e concentração do ranking.
- Taxa de falha/duplicação de resgates e latência da API.
- Diferença de participação entre jogadores gratuitos, pagantes e retornantes.

## Estado técnico atual
As missões diárias iniciais foram ligadas aos registros existentes de construção, treinamento, pesquisa e batalhas PvE. A migração `0008_liveops_daily_claims.sql` persiste o resgate único, registra o crédito confirmado e cria índices para consultas por reino/tipo/data. Os créditos também são lançados em `resource_ledger` na mesma operação D1. Os demais modos deste catálogo são especificação de produto, não devem aparecer como eventos ativos nem conceder recompensas até terem backend, testes e interface próprios.

## Referências
- Clash of Kings — histórico oficial de atualizações e eventos: https://apps.apple.com/us/app/clash-of-kings-cok/id945274928
- Rise of Kingdoms — eventos de aniversário, quiz, treinamento e expedições: https://apps.apple.com/ca/app/rise-of-kingdoms/id1354260888
- Whiteout Survival — Alliance Showdown e Tundra Trade Route: https://apps.apple.com/gb/app/whiteout-survival/id6443575749
- Whiteout Survival — atualizações oficiais de 2026, Winter Siege, participantes, canais de liderança, lembretes e horários: https://www.centurygames.com/whiteout-survival-wos-update/ e https://www.centurygames.com/whiteout-survival-new-content-update/
- Cloudflare Durable Objects — coordenação persistente: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Cloudflare Workers — filas, tarefas em segundo plano e WebSockets: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
