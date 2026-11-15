# Auditoria comparativa — Clash of Izzy (15 nov 2026)

## Resultado executivo
O repositório já contém uma base de estratégia persistente: Worker + D1, sessão de jogador, produção aplicada na leitura do estado, edifícios, tropas, marchas, territórios, relatórios, heróis, dragão, pesquisa, alianças, eventos, inventário e loja. Isso é mais do que uma arena isolada, mas não significa que todos esses sistemas estejam completos ou equilibrados.

A entrada anterior levava diretamente para arena.html, uma experiência de ação com herói, habilidades e Nexus. Isso comunica o gênero errado para quem espera um jogo 4X de reinos. A experiência principal deve começar na cidade/reino; a arena fica como modo complementar.

## Mudanças aplicadas nesta rodada
- Criado kingdom.html: painel de reino conectado ao estado real de GET /api/game/state; usa a sessão existente e só funda um reino quando não há token salvo.
- A página apresenta recursos, castelo, edifícios, poder, tropas, marchas, territórios, aliança e crônicas a partir dos dados retornados pelo Worker.
- Os botões de melhoria enviam { type: "upgrade", building } para POST /api/game/action; custo, validação e resultado continuam no servidor.
- A entrada index.html passa a priorizar “Entrar no Reino” e mantém a Arena como modo secundário.
- Nenhuma migração ou exclusão de dados foi feita.

## Auditoria funcional
| Pilar | Evidência no código | Lacuna / próxima validação |
|---|---|---|
| Persistência | Token de jogo, estado D1, produção aplicada ao consultar estado | Testar continuidade real em dois dispositivos e relógio offline |
| Cidade | Tabela de edifícios e ação upgrade | Render 3D/isométrico real, filas e prévias de custo/tempo |
| Economia | Recursos, ledger e compras | Auditoria transacional de todas as rotas e balanceamento de fontes/sumidouros |
| Exército | Tipos de unidades e quantidades | Filas de treino, tiers desbloqueáveis, feridos e counters completos |
| Mundo | Territórios e marchas | Mapa navegável, coordenadas legíveis, exploração e estados de ocupação |
| Combate | Simulador determinístico e relatórios | Resolver PvP, defesa, reforços, rally, perdas e anti-replay |
| Social | Estrutura de alianças, chat, convites e guerras | Validar permissões, moderação, ajuda mútua e objetivos coletivos |
| Progressão | Heróis, dragão, pesquisa, materiais e prestígio | Árvores, pré-requisitos, equipamentos e sinergias transparentes |
| LiveOps | Eventos e crônicas | Calendário configurável, pontuação, recompensas e ferramentas de operação |
| Monetização | Loja e inventário | Integração real de pagamentos, confirmação por webhook e proteção contra fraude |

## Direção de produto recomendada
O loop central deve ser: produzir → construir → pesquisar → treinar → explorar → marchar → combater/conquistar → cooperar em aliança → receber recompensas → expandir. Cada ação deve alterar estado compartilhado e verificável no servidor.

Boas práticas consultadas para jogos persistentes destacam mundo contínuo, mapa/território, economia conectada, alianças e objetivos coletivos. A arquitetura deve manter o servidor como autoridade e o cliente como apresentação. Referências:
- PocketGamer, visão do gênero 4X: https://www.pocketgamer.biz/finding-success-in-4x-strategy-games/
- Google Play Games insights, fundamentos de 4X e dimensão social: https://services.google.com/fh/files/misc/apps-games-insights-episode-11-transcript.pdf
- Guia de desenvolvimento de estratégia mobile e LiveOps: https://ilogos.biz/mobile-strategy-game-development/

## Prioridades seguintes
1. Testes de integração para sessão, economia, upgrades, treinamento, marchas e repetição de requisições.
2. Mapa mundial interativo com posições, tipos de terreno, recursos, proprietários e marcha em andamento.
3. Filas e temporizadores persistentes de construção e treinamento, resolvidos no servidor.
4. Combate PvE e PvP com relatório reproduzível, reforços e regras claras de proteção.
5. Sistema de aliança jogável de ponta a ponta: busca, convite, ajuda, rally, guerra e ranking.
6. Substituir gradualmente a representação esquemática da cidade por arte isométrica/3D otimizada para celular.

## Limites desta rodada
A interface nova foi conectada ao contrato de API já existente; não foi possível executar npm test / Wrangler neste ambiente GitHub connector. O deploy continua condicionado à credencial Cloudflare válida. A página nova não deve ser anunciada como jogo 3D completo: é uma primeira central de gerenciamento de reino, ainda usando representação visual esquemática.
