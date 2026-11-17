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
| Jogadores | `players`, `player_accounts`, `player-accounts.js`, `account.html` | Conta persistente por senha já implementada e vinculada ao `players.id` existente; sessões continuam assinadas por `SESSION_SECRET`. O provedor de e-mail transacional ainda não está configurado na última verificação. |
| Castelos e recursos | `kingdoms` | Existe; recursos, poder, nível e produção pertencem ao reino. |
| Edifícios e upgrades | `kingdom_buildings` + `kingdom_queues` | Existe; filas persistentes e conclusão pelo Worker/Cron. |
| Tropas | `army_units` | Existe; treinamento e consumo são validados no servidor. |
| Alianças | `alliances`, `alliance_members`, convites e guerras | Existe; criação, ingresso, membros e operações sociais. |
| Chat | `alliance_chat` | Existe como chat de aliança; não equivale a um chat global. |
| Loja e pedidos | `purchase_requests`, `mercadopago_orders`, `mercadopago-orders.js` | Fallback manual e estrutura de checkout individual/webhook idempotente implementados no código. Na última verificação, `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` estavam ausentes; checkout automático não estava operacional em produção. |
| Eventos | `kingdom_events`, `world_events` e módulos específicos | Existe; o Anjo da Morte está implementado em `angel-death-event.js`. |
| Mapa mundial | `world_territories`, `marches`, rallies e UI do mapa | Existe; usa o mapa próprio, não um alerta “em breve”. |
| Cena medieval 3D | `kingdom.html`, `scripts/kingdom-3d.js`, manifesto de assets | Existe; renderer Three.js com fallback e carregamento progressivo. |
| PWA | `manifest.json` e `sw.js` | Existe. Último smoke público: cache v26. Branch candidata deste PR: cache v28, incluindo Salão da Coroa; só passa a produção após merge, deploy e novo smoke test. |
| Deploy | `wrangler.jsonc` e workflows em `.github/workflows/` | Existe; pipeline aplica migrações, publica Worker/assets e executa smoke test. |
| Ranking global | `leaderboard.js`, `ranking.html`, `ranking.js` | Branch candidata: API pública somente de leitura, paginada e limitada por IP, com ranking de reinos e alianças. Não requer nova tabela D1. |

## 3. Ordem de aplicação

### Fase 1 — Banco de dados D1

**Aplicado na arquitetura existente:** o banco usa migrações incrementais numeradas em `migrations/`, incluindo as entregas posteriores de contas e pedidos Mercado Pago. Consulte os arquivos do repositório e `wrangler d1 migrations list` para o estado exato; não presuma que o maior número no Git prova a aplicação no D1 remoto.

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
- `POST /api/game/start`: cria um reino e entrega token assinado.
- `GET /api/game/state`: carrega o estado autenticado do reino.
- `POST /api/game/action`: recebe ações de jogo e aplica regras no servidor.
- O método `scheduled` do Worker processa filas e tarefas recorrentes.

Ações de construção, treinamento, pesquisa, marchas, alianças, combate e evento devem continuar integradas ao contrato de ação existente. Não criar uma segunda API simplificada para alterar diretamente recursos ou níveis.

**Estado corrigido:** cadastro/login persistente já está implementado em `player-accounts.js`, com migração própria e vínculo à identidade existente `players.id`; `/api/account/register`, `/api/account/login` e `/api/account/status` reutilizam o token assinado do jogo e a versão de sessão da conta. Recuperação e verificação por e-mail dependem de um provedor transacional, que estava ausente na última verificação. Não criar uma segunda identidade ou outro sistema de sessão.

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

**Estado e pendências de interface:** as telas de cadastro/login já existem. O chat atual é de aliança; ainda falta um canal mundial separado. Esta branch candidata adiciona o Salão da Coroa, com ranking de reinos e alianças. Manter os estados “carregando”, “sem conexão”, “erro” e “tentar novamente” nas novas telas.

### Fase 4 — PWA

Arquivos oficiais:
- `manifest.json`
- `sw.js`

O manifesto já abre o reino em `/kingdom.html`. O Service Worker usa cache versionado e exclui chamadas da API do cache offline. Ao adicionar ou alterar assets cacheados, incrementar a versão do cache e atualizar os testes/smoke test correspondentes. Não criar outro Service Worker ou outra chave de versão concorrente.

### Fase 5 — Mercado Pago

**Estado do código:** `mercadopago-orders.js` já implementa checkout individual pela API Orders, referência externa do pedido, idempotência, verificação da assinatura do webhook e consulta do pedido na API antes da liberação. O fluxo Master/link manual permanece disponível como fallback operacional.

**Estado da produção na última verificação:** `mercadoPagoManualFallbackAvailable=true` e `mercadoPagoAutomaticCheckoutConfigured=false`. Portanto, a presença do módulo no repositório não significa que o checkout automático esteja ativo no Worker publicado.

Para ativar a confirmação automática:
1. Configurar `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` diretamente como secrets do Worker Cloudflare.
2. Configurar a URL oficial do webhook no painel Mercado Pago para o endpoint implementado.
3. Validar em ambiente de teste uma compra individual, assinatura, status, moeda, valor e referência externa.
4. Confirmar que o D1 registra o pedido e só libera o item uma vez, inclusive com webhook repetido.
5. Executar smoke test e conferir o indicador `hasMercadoPagoAutomaticCheckout` no endpoint administrativo sem expor os valores dos secrets.

Nunca grave secrets em Git, HTML, logs ou mensagens. Não desligue o fallback Master antes de confirmar o ciclo completo com uma compra controlada.

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
- `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`: GitHub Actions.

`MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` são consumidos pelo módulo de checkout Mercado Pago, mas estavam ausentes na última verificação de produção. O provedor transacional também estava ausente. Configure somente no painel de secrets do serviço correspondente; nunca os adicione ao repositório.

## 4. Escopo já existente e trabalho posterior

### Já integrado na base principal
- Kingdoms, recursos, produção passiva e extrato de recursos.
- Construção, treinamento e pesquisa com filas persistentes e Cron.
- Tropas, territórios, marchas, combate PvE e relatórios/replays.
- Alianças, convites, membros, contribuições, chat e guerras.
- Heróis, equipamentos, forja e bônus calculados no servidor.
- Mascotes e efeitos passivos.
- Evento mundial Anjo da Morte e ranking de pontuação do evento.
- Loja de pacotes/skins com fallback Mercado Pago por link/aprovação Master e código de checkout individual/webhook automático, ainda sem secrets de produção.
- Cidade 3D, mapa mundial, fallback, manifesto 3D e PWA.
- Painel Master, limites de requisição, analytics, feedback e inscrições beta.

### Próximas entregas em ordem segura
1. **Finalizar contas de jogador:** validar recuperação e envio real de e-mail depois de configurar o provedor transacional; cadastro/login persistente já está implementado.
2. **Ativar Mercado Pago automático:** configurar secrets e validar compra/webhook; o código existe e o fallback Master deve ser mantido.
3. **Chat mundial:** canal global com limites, paginação, retenção e moderação; sem misturar mensagens globais com `alliance_chat`.
4. **Validar ranking competitivo:** a branch candidata já inclui ranking público paginado de reinos e alianças; conferir dados reais depois de deploy.
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
