# Auditoria de integração segura — D1, Cloudflare Worker, Webhooks e florestas 3D
Data: 2026-11-22

## Decisão

Esta auditoria compara o schema e o Cloudflare Worker propostos externamente com o **código real** do Clash of Izzy. Não substituir o `worker.js`, `wrangler.jsonc` ou as migrations atuais. Não executar `wrangler d1 execute clash-of-izzy-db --file=./schema.sql` sobre produção.

### Compatibilidade com D1 atual

O banco existente possui `players` com IDs inteiros; `kingdoms` é a entidade que guarda recursos, posições e a progressão; `heroes` e `alliances` possuem colunas/relacionamentos já usados pelo Worker. Há `kingdom_queues`, `army_units`, `battle_reports`, `purchase_requests` e `mercadopago_orders`. As tabelas externas `troops`, `city_queues`, `transactions` e `world_events` não são substituições 1:1 e suas rotas falhariam contra o schema real.

O deploy existente utiliza `wrangler.jsonc` com `main: "worker.js"`, D1 binding `DB`, ambiente Preview isolado e cron. O workflow `.github/workflows/deploy-cloudflare.yml` já instala Node.js 22.

### Segurança de autenticação e pagamentos

- **Não aplicar o login proposto:** gravar `password` sem hash e comparar `password === player.password_hash` é inseguro. `player-accounts.js` já possui PBKDF2-SHA256, salt aleatório, iterações configuradas e comparação constante.
- **Não aplicar o webhook proposto:** para as notificações da API Orders a assinatura usa o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, não `id=<requestId>;... + body`. O módulo `mercadopago-orders.js` já valida HMAC, janela temporal, consulta a Order no provedor, vinculação ao pedido, moeda BRL, valor exato e concessão idempotente.
- **Não confiar em `metadata.items_granted`** para definir gemas, madeira ou benefícios. O catálogo e os preços conferidos pelo backend são a fonte autorizada.
- **Não separar concessão e confirmação do pagamento** em vários `DB.prepare(...).run()` independentes. O D1 `batch()` executa SQL em transação; a implementação atual usa lote e guardas condicionais para a liberação.
- Não devolver `error.message` de exceções internas em respostas 500.

### Batalhas, eventos e fila

- O payload de ataque não autoriza tropas sozinho: servidor deve checar propriedade, estoque disponível, capacidade de marcha, alvos, escudos, cooldown, efeitos de heróis e consumo atômico; o jogo já possui regras próprias.
- `damage` recebido de um jogador não é fonte de verdade. Validar rodada e recalcular dano servidor-side. Evitar recompensa duplicada de eventos por solicitações concorrentes ou reentregas.
- Cloudflare Queues usa entrega **at-least-once**. Um eventual consumidor deve gravar IDs de deduplicação e estados transacionais, permitir retry e configurar DLQ; não basta `message.ack()` após um crédito.
- Não adicionar infraestrutura de Queue sem benchmark operacional, necessidade real e orçamento de Cloudflare.

### Melhoria visual incluída nesta PR

A versão atual de `world-map-3d.js` já usava `addInstancedForest` para o terreno. Porém `createTerritoryFeature` ainda chamava `addTree()`, função eliminada da atualização anterior. A PR corrige a falha ao agrupar árvores de territórios e preserva o trono e as marchas.

- Para cada grupo, quatro possíveis batches: troncos, topo e copas de duas cores (a quarta malha só existe quando há as duas variantes).
- Atualiza bounding box e sphere para culling por grupo.
- Libera os buffers de instâncias e evita múltiplas liberações da geometria compartilhada.
- Atualiza a versão do cache PWA (v51 para v52) para propagar `world-map-3d.js` ao Android.
- Acrescenta teste de regressão `tests/world-forest-instancing-regression.test.js`.

**Não** implementa LOD individual, billboards, uma fila nova, SQL remoto, rotas diferentes ou mudanças na economia. A melhoria precisa de validação em aparelho Android para afirmar ganho de desempenho.

## Verificações antes de integrar em produção

1. CI `npm test`, sintaxe JavaScript, testes do mapa e do Service Worker.
2. Build Worker `npm run check` em ambiente de validação e validação visual no Android real.
3. Verificar que cada território de floresta abre sem exceção; testar trono, zoom, marchas, mudança de mapa e navegação repetida.
4. Comparar contagem de draw calls, memória WebGL e frametime p50/p95 contra a versão anterior.
5. Só após estes gates, considerar merge/deploy. Nenhuma migration D1 remota nem alteração de secret foi feita nesta revisão.

## Documentação oficial consultada

- Mercado Pago: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/optional-notifications
- Cloudflare D1 batch: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Cloudflare Queues: https://developers.cloudflare.com/queues/reference/delivery-guarantees/
- Cloudflare Queues DLQ: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
