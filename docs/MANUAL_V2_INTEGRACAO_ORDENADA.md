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
- `arena.html`: loja integrada com o checkout Mercado Pago.

Não trocar a cena 3D existente por uma caixa dourada de demonstração nem substituir a interface atual por um HUD paralelo. Os controles novos devem usar os dados retornados pela API e padrões visuais compartilhados.

**Pendências de interface:** a tela de cadastro/login existe em `account.html`; falta completar recuperação/alteração de senha e validar o fluxo em outro dispositivo. O chat implementado nesta edição é o chat de aliança (`alliance_chat`); chat mundial separado, paginação, retenção e moderação continuam pendentes. Preservar os estados “carregando”, “sem conexão”, “erro” e “tentativa novamente”.

### Fase 4 — PWA

Arquivos oficiais:
- `manifest.json`
- `sw.js`

O manifesto já abre o reino em `/kingdom.html`. O Service Worker usa cache versionado e exclui chamadas da API do cache offline. Ao adicionar ou alterar assets cacheados, incrementar a versão do cache e atualizar os testes/smoke test correspondentes. Não criar outro Service Worker ou outra chave de versão concorrente.

### Fase 5 — Mercado Pago

**Estado atual:** a loja cria pedido individual em `purchase_requests`. O Worker contém checkout individual Mercado Pago Orders (`POST /api/store/checkout`) e webhook (`POST /api/webhook/mp`) em `mercadopago-orders.js`. Quando as credenciais não estão configuradas, a interface preserva o link hospedado compartilhado `https://link.mercadopago.com.br/pagamentosskin` e a aprovação manual Master como alternativa auditável.

**Webhook automático está implementado no código, mas ainda não está liberado operacionalmente.** O checkout individual gera `external_reference` opaca e chave de idempotência por pedido; o webhook valida HMAC-SHA256, consulta a Order diretamente no Mercado Pago, confere referência, valor, moeda e pagamentos processados, e só então credita/libera em lote idempotente no D1. A presença dos secrets no Worker e uma compra/webhook real ainda não foram confirmadas. O link compartilhado não oferece associação individual automática. Nunca aceitar `payment_reference` digitado pelo usuário como prova de pagamento.

Para ativar a confirmação automática em produção, as próximas validações deverão:
1. Configurar `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` diretamente nos secrets do Worker (nunca no Git ou em `wrangler.jsonc`).
2. Configurar a URL oficial de notificação do Mercado Pago para `POST /api/webhook/mp`.
3. Executar compra de teste de baixo valor e receber uma notificação assinada do ambiente real; verificar também assinatura inválida, pedido expirado e notificação duplicada.
4. Conferir que o valor, a moeda BRL, o status `processed`, a referência externa e o ID da Order correspondem ao pedido.
5. Confirmar que a liberação idempotente ocorre uma única vez no D1 e que nenhuma referência digitada pelo jogador altera o saldo.
6. Manter a aprovação Master e o link compartilhado como fallback até a validação de ponta a ponta.

Essa etapa depende de secrets reais e URL de notificação configurados no Worker. Não anunciar pagamento automático nem remover o fallback até completar o teste assinado de ponta a ponta; essa configuração ainda não foi confirmada nesta auditoria.

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
- `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`: checkout Orders/webhook Mercado Pago (configuração em produção ainda pendente de confirmação);
- `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`: GitHub Actions.

`JWT_SECRET` não é usado pela implementação atual: a sessão de jogo/conta usa `SESSION_SECRET`. `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` já são consumidos por `mercadopago-orders.js`, mas só devem ser marcados como configurados após conferência no Worker e teste real do webhook.

## 4. Escopo já existente e trabalho posterior

### Já integrado na base principal
- Kingdoms, recursos, produção passiva e extrato de recursos.
- Construção, treinamento e pesquisa com filas persistentes e Cron.
- Tropas, territórios, marchas, combate PvE e relatórios/replays.
- Alianças, convites, membros, contribuições, chat e guerras.
- Heróis, equipamentos, forja e bônus calculados no servidor.
- Mascotes e efeitos passivos.
- Evento mundial Anjo da Morte e ranking de pontuação do evento.
- Loja de pacotes/skins com Mercado Pago por link e aprovação Master.
- Cidade 3D, mapa mundial, fallback, manifesto 3D e PWA.
- Painel Master, limites de requisição, analytics, feedback e inscrições beta.

### Próximas entregas em ordem segura
1. **Contas de jogador:** concluir recuperação/alteração de senha e validar cadastro/login entre dispositivos com preservação do mesmo `players.id` e reino.
2. **Mercado Pago automático:** configurar secrets e URL de notificação; validar checkout e webhook assinados no ambiente real, manter o fluxo Master como fallback.
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
