# Clash of Izzy v2.0 — manual mestre de integração por fases

**Objetivo:** integrar todos os requisitos funcionais do Manual de Reconstrução Total v2.0 à aplicação real, sem apagar a base de produção, recriar identidades, duplicar tabelas ou substituir recursos mais completos por demonstrações simplificadas.

**Repositório de referência:** `jorgepereiragha-cyber/Clash-of-Izzy-`  
**Branch-base:** `main`  
**Worker:** `https://clash-of-izzy.jorgepereiragha.workers.dev`

## 1. Regra de integração

O código de referência enviado é uma implementação independente e simplificada. Ele não deve ser copiado por cima do projeto atual. A aplicação real já possui um modelo relacional, uma API same-origin, filas persistentes, validações no servidor, rotinas agendadas, interface 3D, mapa mundial, loja e sistemas de aliança/eventos.

A integração deve seguir estas regras:

1. Preservar todos os dados e IDs já existentes em D1.
2. Criar sempre migrações incrementais numeradas; nunca substituir o histórico por um único `schema.sql`.
3. Manter `worker.js` como entrypoint do Cloudflare Worker, conforme `wrangler.jsonc`.
4. Reutilizar `coi_game_token` e a assinatura/verificação de sessão existente; não criar um segundo sistema de sessão em paralelo.
5. Manter o servidor como autoridade para recursos, timers, tropas, batalhas, recompensas e pagamentos.
6. Só declarar produção concluída depois de CI, deploy e smoke test público. CI ou Preview isolados não comprovam publicação em produção.

## 2. Mapeamento do Manual v2.0 para a arquitetura real

| Requisito do manual | Implementação a reutilizar | Estado verificado na `main` |
|---|---|---|
| Jogadores | `players` e identidade pública `player_id` | Existe; criação de reino usa sessão assinada. Não há conta persistente por senha. |
| Castelos e recursos | `kingdoms` | Existe; recursos, poder, nível e produção pertencem ao reino. |
| Edifícios e upgrades | `kingdom_buildings` + `kingdom_queues` | Existe; filas persistentes e conclusão pelo Worker/Cron. |
| Tropas | `army_units` | Existe; treinamento e consumo são validados no servidor. |
| Alianças | `alliances`, `alliance_members`, convites e guerras | Existe; criação, ingresso, membros e operações sociais. |
| Chat | `alliance_chat` | Existe como chat de aliança; não equivale a um chat global. |
| Loja e pedidos | `purchase_requests` | Existe; pedido idempotente e aprovação pelo painel Master. |
| Eventos | `kingdom_events`, `world_events` e módulos específicos | Existe; o Anjo da Morte está implementado em `angel-death-event.js`. |
| Mapa mundial | `world_territories`, `marches`, rallies e UI do mapa | Existe; usa o mapa próprio, não um alerta “em breve”. |
| Cena medieval 3D | `kingdom.html`, `scripts/kingdom-3d.js`, manifesto de assets | Existe; renderer Three.js com fallback e carregamento progressivo. |
| PWA | `manifest.json` e `sw.js` | Existe; shell atual usa cache v23. |
| Deploy | `wrangler.jsonc` e workflows em `.github/workflows/` | Existe; pipeline aplica migrações, publica Worker/assets e executa smoke test. |

## 3. Ordem de aplicação

### Fase 1 — Banco de dados D1

**Aplicado na arquitetura existente:** o banco usa migrações em `migrations/`; a `main` desta auditoria contém migrations até `0025`. A PR #120 propõe migrations aditivas `0026_single_shared_realm.sql` e `0027_castle_skin_equipment.sql`; elas só devem ser aplicadas em D1 de Preview isolado antes de qualquer migração de produção.

Correspondência dos nomes do exemplo:

- `players` continua sendo a identidade do jogador; sua chave interna é INTEGER e `player_id` é o identificador público.
- `castles` corresponde a `kingdoms`.
- `buildings` corresponde a `kingdom_buildings`.
- `troops` corresponde a `army_units`.
- `chat_messages` não deve ser criado em paralelo ao chat de aliança `alliance_chat`.
- `transactions` não deve ser criado como cópia de `purchase_requests`; a entrega de itens usa o fluxo auditável existente.
- Eventos devem usar as tabelas e os módulos de eventos do jogo.

**Não executar:** o SQL integral do exemplo com `CREATE TABLE` para substituir ou duplicar os objetos acima. Isso fragmentaria o estado do reino e poderia comprometer dados de produção.

### Fase 2 — Worker e API

**Entry point correto:** `worker.js`.  
**Configuração correta:** `wrangler.jsonc`.

Rotas e contratos já existentes:
- `POST /api/game/start`: cria um reino e entrega token assinado; com uma sessão válida já vinculada a um reino, retoma esse mesmo estado, sem criar uma segunda cidade.
- `GET /api/game/state`: carrega o estado autenticado do reino.
- `POST /api/game/action`: recebe ações de jogo e aplica regras no servidor.
- O método `scheduled` do Worker processa filas e tarefas recorrentes.

Ações de construção, treinamento, pesquisa, marchas, alianças, combate e evento devem continuar integradas ao contrato de ação existente. Não criar uma segunda API simplificada para alterar diretamente recursos ou níveis.

**Contas de jogador — parcialmente implementadas:** `account.html` oferece cadastro e login por usuário/e-mail e senha; `player-accounts.js` vincula a conta à identidade `players.id`, deriva senha com PBKDF2-SHA-256 e salt aleatório, limita tentativas e invalida sessões antigas por `session_version`. O login pode recuperar o mesmo reino em outro dispositivo. **Ainda falta recuperação/alteração de senha**, verificação de e-mail e validação prática de sessão entre dispositivos; o e-mail opcional não ativa recuperação automática.

### Fase 3 — Interface do jogo

Arquivos e telas existentes:
- `index.html`: entrada/landing do jogo.
- `kingdom.html`: central do reino, recursos, edifícios, filas e renderização da cidade.
- `world.html` e `world-map.js`: mapa, territórios, tropas e marchas.
- `alliance.html` e `arena.html`: recursos sociais e chat de aliança.
- `events.html` e `events.js`: eventos.
- `equipment-system.js` e telas relacionadas: forja e equipamentos.
- `arena.html`: loja com pedido registrado, redirecionamento WhatsApp e acompanhamento da aprovação Master.

Não trocar a cena 3D existente por uma caixa dourada de demonstração nem substituir a interface atual por um HUD paralelo. Os controles novos devem usar os dados retornados pela API e padrões visuais compartilhados.

**Pendências de interface:** a tela de cadastro/login existe em `account.html`; falta completar recuperação/alteração de senha e validar o fluxo em outro dispositivo. O chat implementado nesta edição é o chat de aliança (`alliance_chat`); chat mundial separado, paginação, retenção e moderação continuam pendentes. Preservar os estados “carregando”, “sem conexão”, “erro” e “tentativa novamente”.

### Fase 4 — PWA

Arquivos oficiais:
- `manifest.json`
- `sw.js`

O manifesto já abre o reino em `/kingdom.html`. O Service Worker usa cache versionado e exclui chamadas da API do cache offline. Ao adicionar ou alterar assets cacheados, incrementar a versão do cache e atualizar os testes/smoke test correspondentes. Não criar outro Service Worker ou outra chave de versão concorrente.

### Fase 5 — Vendas manuais pelo WhatsApp (edição inicial)

**Estado atual:** a loja apresenta os pacotes VIP e as seis skins liberadas. Ao escolher um item, o Worker valida a sessão do jogador, verifica o catálogo e registra um pedido em `purchase_requests` com o método de banco `manual`. A interface abre o WhatsApp comercial `5547996531437` com o número do pedido, ID do jogador, reino, nome do produto e o valor gravado no pedido. Quando existe pedido pendente, o sistema reutiliza os dados e o preço originais.

**Liberação pelo painel Master:** `admin.html` lista os pedidos pendentes e exibe o botão verde `✓ Liberar pacote`. A ação exige sessão administrativa, só processa pedidos ainda pendentes e concede as gemas do pacote VIP ou adiciona a skin ao inventário do jogador. O status é alterado no servidor; o jogador não consegue aprovar o próprio pedido. O Master deve confirmar o recebimento fora do jogo antes de clicar no botão. O WhatsApp apenas abre a conversa, não confirma pagamento.

**Mercado Pago desativado para novos pedidos nesta edição:** `POST /api/store/checkout` retorna `410 MANUAL_WHATSAPP_ONLY`. O webhook legado `POST /api/webhook/mp` permanece somente para compatibilidade com ordens Mercado Pago que já tivessem sido criadas antes da edição manual. Pedidos novos não recebem referência externa nem ID de Order do Mercado Pago e não podem ser liberados por esse webhook. Não configurar nem divulgar checkout automático nesta edição.

Validação antes da publicação:
1. Criar um pedido de pacote VIP e confirmar que o WhatsApp recebe o número do pedido, jogador, reino, produto e preço correto.
2. Criar um pedido de skin e confirmar que a mensagem inclui os dados da skin.
3. Repetir a solicitação do mesmo produto e confirmar que o pedido pendente e o preço originais são reutilizados.
4. No painel Master, aprovar um pedido de teste e verificar que gemas ou skin foram entregues uma única vez.
5. Tentar aprovar o mesmo pedido novamente e confirmar que o Worker rejeita a repetição.
6. Confirmar que uma chamada direta a `/api/store/checkout` retorna `410 MANUAL_WHATSAPP_ONLY`.

Não é necessário configurar `MP_ACCESS_TOKEN` nem `MP_WEBHOOK_SECRET` para vender pela edição inicial. Uma eventual reativação de pagamentos automáticos deve ser uma futura alteração separada, solicitada pelo proprietário, com sandbox, webhook e testes ponta a ponta.

### Fase 6 — Publicação e verificação

O fluxo real está em `.github/workflows/deploy-cloudflare.yml`. A sequência é:

1. executar testes e validações locais/CI;
2. validar o bundle do Worker;
3. aplicar as migrações no D1 descartável de CI;
4. registrar o ponto de recuperação D1 previsto pelo workflow;
5. aplicar migrações pendentes no D1 remoto;
6. publicar Worker e assets;
7. executar smoke test somente de leitura no domínio público.

Bindings e segredos atuais documentados:
- D1: binding `DB`, configurado em `wrangler.jsonc`;
- `SESSION_SECRET`: assinatura/verificação de sessão;
- `ADMIN_EMAIL` e `ADMIN_PASSWORD`: painel Master;
- `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`: não são necessários para vendas manuais desta edição; ficam apenas para compatibilidade do webhook com ordens antigas.
- `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`: GitHub Actions.

`JWT_SECRET` não é usado pela implementação atual: a sessão de jogo/conta usa `SESSION_SECRET`. Os secrets `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` não devem ser adicionados por causa da loja desta edição; o handler de webhook só os consulta para ordens históricas que já existam.

## 4. Escopo já existente e trabalho posterior

### Já integrado na base principal
- Kingdoms, recursos, produção passiva e extrato de recursos.
- Construção, treinamento e pesquisa com filas persistentes e Cron.
- Tropas, territórios, marchas, combate PvE e relatórios/replays.
- Alianças, convites, membros, contribuições, chat e guerras.
- Heróis, equipamentos, forja e bônus calculados no servidor.
- Mascotes e efeitos passivos.
- Evento mundial Anjo da Morte e ranking de pontuação do evento.
- Loja de pacotes/skins com pedidos registrados, redirecionamento WhatsApp e liberação Master.
- Cidade 3D, mapa mundial, fallback, manifesto 3D e PWA.
- Painel Master, limites de requisição, analytics, feedback e inscrições beta.

### Próximas entregas em ordem segura
1. **Contas de jogador:** concluir recuperação/alteração de senha e validar cadastro/login entre dispositivos com preservação do mesmo `players.id` e reino.
2. **Vendas manuais:** validar pedido VIP, pedido de skin, redirecionamento WhatsApp e aprovação Master no D1 Preview isolado e em Android físico.
3. **Chat mundial:** canal global com limites, paginação, retenção e moderação; sem misturar mensagens globais com `alliance_chat`.
4. **Ranking global de poder:** endpoint autenticado/público com ordenação e paginação, distinto do ranking do evento.
5. **Push notifications:** assinatura VAPID, armazenamento de subscriptions, consentimento, remoção de endpoints inválidos e entrega acionada por eventos reais.
6. **Arte 3D final:** ampliar e validar modelos de edifícios, tropas e heróis em dispositivos móveis; os GLBs atuais são base, não o catálogo artístico final.
7. **Teste de lançamento:** smoke test de produção, cadastro/recuperação de conta, construção, treino, aliança, evento, loja e instalação PWA em Android e desktop.

## 5. Critério de conclusão

Uma fase só pode ser marcada como concluída quando houver:
- migração aditiva e teste de contrato/integrado, quando houver mudança de D1;
- teste Worker + D1 local para rotas e regras;
- validação de sintaxe, bundle e assets;
- CI concluída com sucesso;
- deploy de produção concluído pelo workflow;
- smoke test público correspondente;
- conferência manual para recursos que dependam de navegador, conta externa ou dispositivo físico.

**Resultado:** este manual mantém todos os requisitos do documento recebido, mas os organiza sobre a arquitetura efetivamente publicada. A base existente é preservada; as lacunas reais ficam explícitas e entram em uma sequência única de implementação, sem declarar como ativos recursos que ainda dependem de desenvolvimento ou configuração externa.
