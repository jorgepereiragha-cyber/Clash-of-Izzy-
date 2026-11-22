# Clash of Izzy — Guia mestre de integração e continuidade
**Conferido com o repositório em 22/11/2026.** Documento técnico para desenvolvedores e outras IAs. Não é um atestado de release comercial ou de desempenho em Android físico.

## 1. Objetivo e arquitetura em uso
Clash of Izzy é um jogo de estratégia 4X medieval, com mapa mundial, castelo, exércitos, alianças, eventos, heróis e compras. O frontend atual é PWA HTML/CSS/JavaScript com Three.js (não Babylon.js). O backend é **um Cloudflare Worker**, cuja entrada é `worker.js`; o D1, via binding `env.DB`, armazena o estado autoritativo do jogo. Há uma integração `ELDORIA_ROOM` com Durable Objects para funcionalidades de tempo real.

A raiz do repositório contém os assets entregues via `wrangler.jsonc` (`assets.directory: "."`). **Não** reorganize arquivos para `public/` ou substitua `worker.js` por `src/index.js` sem refatoração e testes de migração. O desenho com KV, Queues e R2 é uma **possível evolução**, não infraestrutura confirmada nem requisito para iniciar.

Arquivos de entrada:
- `worker.js`: APIs, estado do jogo, cron e regras do servidor;
- `wrangler.jsonc`: Worker, assets, D1, preview, cron, Durable Objects;
- `migrations/`: migrações D1 incrementais;
- `world.html`, `world-map-3d.js`, `world-map.js`: mapa e interação;
- `kingdom.html`, `scripts/kingdom-3d.js`: cidade;
- `sw.js`: shell PWA, cache offline seguro;
- `player-accounts.js`: contas, senhas e sessão;
- `mercadopago-orders.js`: checkout e webhook de Orders;
- `tests/`: Node, regras, banco, segurança, interface e Playwright;
- `.github/workflows/ci.yml` e `.github/workflows/deploy-cloudflare.yml`: CI e publicação controlada.

## 2. Instalação e validação local
Requer Node.js 22 conforme CI do projeto. Preferir as versões pinadas de `package.json`/lockfile.

```bash
npm install
npm run db:migrate:local
npm run db:migrate:preview:local
npm run assets:validate
npm test
npm run test:e2e
npm run check
npm run dev
```

O navegador local e a CI não substituem a inspeção Android física. Os scripts de migrations remotas **não** são comandos seguros para executar sem auditoria, backup, isolamento e decisão de release.

## 3. D1: dados e migração
Não execute o `schema.sql` genérico enviado anteriormente: o projeto atual já tem `players`, `kingdoms`, `heroes`, `alliances`, `army_units`, `kingdom_queues`, `battle_reports`, `purchase_requests`, `mercadopago_orders`, `world_territories` e tabelas adicionais. Seus IDs, relacionamentos e regras não coincidem com o schema proposto (`troops`, `city_queues`, `transactions` etc.).

Mudanças de banco devem ser migrations incrementais novas, testadas primeiro localmente e depois em D1 de Preview isolado. Verifique o estado de migrações e capture ponto de recuperação D1 antes de qualquer migração remota em produção. D1 é SQLite gerenciado pela Cloudflare, com recursos de replicação de leitura conforme configuração; não presumir consistência global instantânea de escrita.

## 4. Segurança de autenticação
`player-accounts.js` já usa PBKDF2-SHA256 com salt, validação de parâmetros e comparação constante. Não use senha em texto puro, não faça `password === password_hash`, não crie outro fluxo de login sem migração de contas e não exponha JWT em logs. Tokens de sessão, roles administrativas, autorização por recurso e expiração devem ser verificadas no Worker. Não é necessário adicionar `jose` ou `itty-router` apenas porque aparecem em um exemplo separado.

## 5. Mercado Pago, Pix e recompensas
`mercadopago-orders.js` usa `/api/webhook/mp`, não a rota fictícia `/webhook/mercado-pago`. A API de Orders é distinta da API de Payments. O HMAC de Orders usa o manifesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Validar assinatura, prazo anti-replay, consulta autenticada da Order ao Mercado Pago, vínculo ao pedido interno, valor exato e moeda antes de liberar itens. Catálogo e concessão são **server-side**. O fluxo usa `purchase_requests` e `mercadopago_orders`, com operação D1 atômica e idempotência; jamais confiar em `metadata.items_granted` para conceder gemas.

Nubank/Pix e Mercado Pago não devem receber benefícios ou publicação de checkout até a reconciliação e as respectivas credenciais/integrações terem sido testadas. Nunca gravar tokens, senhas, Pix privados ou keystores no repositório ou documentos de acompanhamento.

## 6. Regras de jogo e combate
Manter processamento autoritativo em Worker/D1: validar tropa e quantidade disponível, capacidade e slots de marcha, escudos, custos, cooldown, alvo, território, heróis, resultado e loot. O cliente transmite **intenção**, não dano final nem número de recursos concedidos. Evitar randomização de loot sem vínculo com os recursos reais e sem débito/crédito atômico. Não sobrescrever `game-adapter.js`, `march-capacity.js`, `march-slots.js`, `rally.js` ou regras do trono por um simulador didático simplificado.

## 7. Eventos e filas
O evento Anjo da Morte e demais eventos existentes devem respeitar a participação calculada pelo servidor e deduplicação das recompensas. Cloudflare Queues é opcional: antes de criar uma Queue, projetar idempotency key por mensagem, persistência de processamento, tentativas e dead-letter queue. Entrega de mensagens pode ocorrer mais de uma vez; `ack()` sozinho não impede dupla recompensa. Testar concorrência e recuperação de falhas com D1 de Preview.

## 8. Renderização 3D no Android
Usar `THREE.InstancedMesh` apenas quando os meshes compartilham geometria/material; meshes de tronco, topo e copas de cores diferentes podem exigir batches distintos. O mapa atual já tinha instancing em terreno, mas mantinha chamadas a `addTree()` em territórios florestais sem a função existir. A PR vinculada a este guia corrige a decoração por `addInstancedForest`, atualiza bounding box/sphere e faz limpeza de buffers/geometrias com deduplicação. Não promete ganho específico de FPS: medir em aparelhos reais. `scale(0)` não é LOD; LOD exige troca efetiva de nível de geometria/material ou billboards.

## 9. PWA
O projeto usa cache `clash-of-izzy-shell-v52` nesta PR, não v31. O Service Worker protege o tráfego autenticado: rotas `/api/*`, requisições não-GET, origem externa e headers de autorização não devem ser interceptados por cache. Cache de assets é separado e limitado, com fallback offline. Não usar estratégia universal `caches.match(request) || fetch(request)` para qualquer requisição.

## 10. CI, publicação e distribuição Android
A CI principal roda Node.js 22, migrations D1 locais, testes Node/Playwright, verificação de assets e build seco do Worker. `deploy-cloudflare.yml` exige confirmação explícita de produção, verificações remotas, ponto de recuperação D1 e smoke tests; não contornar esses gates.

PWA, APK sideload e distribuição Play Store têm workflows e contratos diferentes. Um build aprovado do APK não comprova por si só versão pública instalável, assinatura comercial, atualização in-place ou aprovação da Play Store.

## 11. Administração, observabilidade e monetização
Admin deve usar rotas e autenticação existentes. Proteja informações financeiras, contas e permissões administrativas; não retorne `error.message` em erros 500. Monitore taxa de erro, latências p50/p95, filas, pagamentos reconciliados, draw calls, frame time e uso de memória em dispositivos. Alertas e limites devem refletir medições reais, não números apresentados como garantias.

## 12. Prioridades de entrega
**Agora:** concluir PR de correção de territórios florestais, aprovar CI e inspecionar mapa, castelos, trono, marchas e cache PWA em Android. Validar operabilidade do APK/sideload e da API hospedada sem mudanças no banco de produção.

**Depois:** homologar pagamentos reais e anti-fraude com credenciais válidas, validação de fluxo de ponta a ponta e conciliação; estabilizar as regras de batalha e balanceamento; medir capacidade/custos de produção.

**Opcional e posterior:** Cloudflare Queues, KV, R2, Web Push, novos mundos, efeitos visuais ou mudança de infraestrutura, sempre com necessidade medida, modelo de ameaça, testes e orçamento.

## 13. Critérios para considerar um recurso finalizado
- PR revisada e checks verdes na revisão exata do commit;
- testes de integração e segurança aprovados, sem writes no D1 de produção para homologação;
- evidência Android física para recursos gráficos;
- deploy rastreável e smoke test ao vivo apenas quando autorizado;
- roll-back e logs disponíveis;
- pagamento só declarado funcional quando pedido, notificação, verificação e concessão idempotente tiverem sido observados em ambiente adequado.

**Status documental:** este guia é um mapa de integração baseado no código inspecionado; não afirma que todas as funções estejam homologadas ou publicadas. Não faça mudanças remotas destrutivas a partir do texto deste guia.
