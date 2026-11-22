# Clash of Izzy — inspeção segura de uma compra P1 no D1 Preview

**Estado: guia de homologação, não uma comprovação de pagamento.**
Esta consulta é de leitura, mas só pode ser usada contra **D1 Preview confirmado e isolado** após a migração `0042_level_packs_p1_p8.sql` estar aplicada. Não usar como autorização para consultar ou testar pagamentos no D1 de produção.

## Dados e chaves reais

- `players.id`: INTEGER interno; `players.player_id`: identificador público textual.
- `kingdoms.player_id` referencia `players.id`.
- `purchase_requests.id`: INTEGER interno do pedido. `purchase_requests.mp_order_id`: identificador externo da Order Mercado Pago.
- `purchase_requests.mp_payment_status`: status armazenado do pagamento.
- `mercadopago_orders.status`: status armazenado da Order; esta tabela **não tem** uma coluna `mp_payment_status`.
- `level_pack_claims.request_id` referencia `purchase_requests.id`, não o ID externo do pagamento.
- Só consultar `level_pack_claims` após 0042. Esta tabela não existe na `main` de produção antes da integração e migração.

## Consulta de um pedido específico

Substitua **apenas** os dois valores de identificação por valores de teste autorizados. Use a função de consulta parametrizada da ferramenta que executar, quando disponível; não monte SQL com entrada não confiável. Não publicar as identidades, saldos ou resultados em logs públicos.

```sql
SELECT
  p.player_id AS public_player_id,
  r.id AS internal_request_id,
  r.mp_order_id,
  r.product_name,
  r.price_brl,
  r.status AS request_status,
  r.mp_payment_status AS recorded_payment_status,
  m.status AS cached_order_status,
  m.amount_cents,
  m.fulfilled_at,
  c.pack_level,
  c.granted_at,
  p.gems,
  k.wood, k.food, k.stone, k.iron, k.gold
FROM purchase_requests AS r
JOIN players AS p ON p.id = r.player_id
JOIN kingdoms AS k ON k.id = r.kingdom_id AND k.player_id = p.id
LEFT JOIN mercadopago_orders AS m
  ON m.request_id = r.id AND m.order_id = r.mp_order_id
LEFT JOIN level_pack_claims AS c
  ON c.request_id = r.id AND c.kingdom_id = k.id
WHERE p.player_id = 'PUBLIC_PLAYER_ID_DE_TESTE'
  AND r.mp_order_id = 'ORDER_MP_DE_TESTE'
  AND r.product_name = 'Pacote Lord Iniciante';
```

O resultado deve ter **exatamente uma linha** para uma Order P1 conhecida. Nenhuma linha significa que a consulta não localizou um pedido correspondente; não significa automaticamente ausência de pagamento. Uma linha não comprova que houve crédito correto. Verifique `request_status`, status confirmado **diretamente na API do Mercado Pago Sandbox**, valor em centavos 990, `fulfilled_at`, `pack_level=10` e `granted_at`. Se algo divergir, bloqueie a liberação.

## Prova de saldo e idempotência

Antes de criar o pedido, registre no D1 Preview, com conta sintética isolada, um snapshot das gemas e de cada recurso. Depois de uma Order P1 aprovada e entrega concluída, as variações esperadas, **na ausência de outras ações que mudem saldo**, são: gemas **+500**, madeira **+5.000**, comida **+5.000**, demais recursos **+0**. Repetir o webhook da mesma Order não pode mudar esses saldos; um segundo pedido para a mesma faixa não pode gerar nova concessão. Verifique unicidade, ausência de créditos em pedidos pendentes, recusados e assinaturas HMAC inválidas; concilie eventuais Orders pagas mas não entregues sem prometer estorno automático.

Atenção: o site de produção não é ambiente Sandbox. `npm run dev` usa **D1 local por padrão**, e o `wrangler.jsonc` atual mantém o binding nominal de produção; isso não liga ao D1 Preview remoto nem prova integração real do Mercado Pago. Para usar Preview remoto, é indispensável configurar um ambiente de homologação dedicado, com bindings separados, credenciais Sandbox e webhook isolado, e comprovar que dados de produção não podem ser acessados.

O workflow [Prepare Clash of Izzy Preview D1 (isolated)](../.github/workflows/prepare-preview-d1.yml) pode aplicar migrações **somente** com autorização expressa de que o Preview é descartável, confirmação do UUID exato e branch confiável autorizada. Ele não homologa pagamentos. O workflow [Cloudflare Paid Readiness (read-only)](../.github/workflows/cloudflare-paid-readiness.yml) consulta os bancos sem aplicá-las.

**Não ativar** `GAME_4X_SYSTEMS_ENABLED`, `LEVEL_PACKS_ENABLED` ou `LEVEL_PACKS_PUBLIC_ENABLED` na `main` para realizar testes de Sandbox.

Referências: `migrations/0001_init.sql`, `migrations/0002_world.sql`, `migrations/0024_player_accounts_mercadopago_orders.sql`, `migrations/0042_level_packs_p1_p8.sql` (PR #236), `docs/PROTOCOLO_RELEASE_SEGURO_2026-11-22.md`, issue #234.
