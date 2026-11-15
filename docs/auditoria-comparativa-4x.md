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


## Revalidação do relatório recebido (15 nov 2026)
A comparação recebida é útil como roteiro, mas algumas afirmações não correspondem ao código atual e não devem ser tratadas como bugs confirmados:

- **Roteador HTTP:** o suposto bug é falso. `worker.js` exporta `default.fetch(request, env)`, serve assets fora de `/api/` e encaminha rotas de jogo e administração. O estado atual não precisa de um segundo roteador.
- **Alianças:** não estão ausentes do backend. Há ações para criar/entrar, convidar/aceitar, promover/expulsar, doar, ajudar, conversar, declarar guerra, reivindicar território e sair. O estado também devolve membros, chat, convites e guerras. A lacuna concreta era a interface de jogo.
- **Central do reino:** não está limitada a placeholders. `kingdom.html` busca o estado autenticado e renderiza recursos, edifícios, tropas, marchas, territórios, aliança e eventos. O visual da cidade, porém, é uma grade CSS esquemática, não um mapa 3D.
- **Equipamentos:** a crítica de segurança é válida para `equipment-system.js`: evolução e ouro são alterados apenas em objetos JavaScript no cliente. Esse módulo não deve ser considerado autoridade de progressão. A migração para validação no servidor continua pendente.
- **Compras com dinheiro real:** `packages.js` encaminha o pedido ao WhatsApp e descreve confirmação manual. Isso não é integração automática de pagamento; não há evidência aqui de checkout e webhook de provedor.
- **Multiplayer:** há estado compartilhado e interação assíncrona via D1, alianças e marchas. Isso não equivale a PvP em tempo real, chat global ou infraestrutura já validada para milhares de jogadores.
- **Produção concorrente:** existe compare-and-set por `last_production_at` e atualização em lote com ledger. Ainda merece teste de integração sob concorrência; não há evidência suficiente para declarar falha.

## Implementação após a revalidação
- Criada `alliance.html`, usando a sessão `coi_game_token` e as ações já existentes do Worker para criação/entrada, convites recebidos, chat, doações, guerra e saída.
- Adicionado acesso **Alianças** à barra de ações de `kingdom.html`.
- Corrigida a consulta de estado do Worker para incluir os saldos compartilhados do depósito da aliança (`shared_food`, `shared_wood`, `shared_stone`, `shared_iron`, `shared_gold`), necessários para a interface mostrar os valores reais.
- Adicionados testes de regressão para o contrato da interface e os saldos do depósito.

## Próximas prioridades revisadas
1. Migrar equipamentos para tabelas e ações server-authoritative, com validação de inventário, custos, nível e efeitos.
2. Testar fluxos de aliança ponta a ponta (criação, entrada, convite, chat, doação, guerra) com D1 de teste.
3. Implementar filas persistentes de construção, treinamento e pesquisa, com conclusão calculada pelo servidor.
4. Criar mapa mundial navegável com terreno, coordenadas, fog of war e territórios; preservar a arena como modo separado.
5. Implementar PvP assíncrono entre reinos com proteção, reforços, relatório e anti-replay antes de considerar tempo real.
6. Integrar pagamento real somente com provedor, webhook assinado e entrega idempotente.

- Reforçada a entrada por sigla: `alliance_join` agora verifica a capacidade máxima antes de inserir o membro; foi adicionado teste de regressão para esse limite.


## Evolução técnica — equipamentos (15 nov 2026)
- A evolução anterior em `equipment-system.js` alterava ouro e nível somente em objetos JavaScript do navegador. Esse fluxo foi substituído por ações autenticadas `equipment_upgrade` e `equipment_lock` no Worker.
- Criada a tabela `kingdom_equipment` na migração `0008_kingdom_equipment.sql`, com chave única por reino/equipamento, nível limitado e estado de bloqueio.
- O estado do reino agora inclui equipamentos persistentes. O servidor calcula custos e atributos; o navegador não pode definir preço, ouro, nível ou atributos.
- A evolução debita ouro e altera o nível em um único lote D1, com guarda de concorrência e evento de auditoria.
- A tela ganhou seleção dos quatro equipamentos iniciais e foi ligada à central do reino.
- Criado `tests/equipment-authority.test.js` para impedir regressão ao modelo puramente local.

## Próximos passos técnicos prioritários
1. Executar a suíte `npm test`, validar o bundle Wrangler e confirmar a aplicação remota da migração 0008 pelo GitHub Actions.
2. Criar testes de integração D1 para upgrade concorrente, ouro insuficiente, item bloqueado, nível máximo e repetição de requisições.
3. Migrar atributos de equipamentos para o cálculo efetivo de combate e produção; hoje os níveis e os atributos exibidos já persistem, mas a aplicação dos bônus no simulador ainda precisa ser conectada e balanceada.
4. Evoluir `kingdom.html` para mapa isométrico/3D com posicionamento híbrido: edifícios principais em áreas definidas e decorações com posicionamento livre.
5. Criar atlas de texturas PBR/estilizadas, materiais por bioma, iluminação e animações com fallback gráfico para celulares modestos.
6. Substituir itens temporários da loja por catálogo de temporadas com regras de raridade, coleção, prévia visual e confirmação de compra segura.

## Estado de validação
As alterações foram gravadas na branch principal. O workflow configurado executa testes, valida o bundle, aplica migrações locais e remotas e publica Worker/assets. A execução e o resultado do pipeline precisam ser confirmados antes de declarar a versão publicada e pronta.


## Integração dos bônus de equipamentos (15 nov 2026)
- Os atributos persistidos dos quatro equipamentos agora alimentam o jogo: ataque e vida aumentam os exércitos nas simulações PvE; defesa reduz dano recebido; bônus de recursos multiplica a produção passiva.
- Conversão de atributos para bônus percentuais: ataque e defesa usam 10 pontos por 1%; vida usa 25 pontos por 1%; produção usa o percentual declarado no item. Limites atuais: 30% para atributos de combate e 50% para produção, evitando crescimento sem teto.
- Os cálculos continuam no Worker; o cliente não escolhe nem calcula os bônus aplicados.
- A migração 0008 já existe e o deploy dessa migração foi confirmado no workflow 43739543760.
- Próxima validação necessária: testes de integração D1 para provar que cada atributo afeta somente o sistema correto, incluindo bloqueio, concorrência e limites máximos.
