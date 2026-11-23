# Homologação Mercado Pago — Clash of Izzy (somente ambiente de teste)

> **Nenhuma venda real é autorizada por este documento.** O código da integração não substitui evidências de homologação. A flag `MP_PAYMENTS_ENABLED` permanece `"false"` em produção.

## Separação obrigatória

- **Produção:** não aplicar migrações comerciais ou configurar `MP_PAYMENTS_ENABLED="true"` antes da liberação formal. Nunca enviar tokens, IDs de transação, identificadores pessoais ou segredos em PRs e logs.
- **Sandbox/staging:** usar Worker e D1 separados, credenciais de teste do Mercado Pago e webhook específico. Confirmar que `DB` referencia exclusivamente o Preview. Nunca fazer testes de compras usando o endpoint público de produção.
- **Operação protegida:** obter aprovação do proprietário antes de escrever nos ambientes remotos, mesmo no Preview. Confirmar Time Travel/backup e restaurabilidade, histórico das migrações, tabelas de pedidos, zero dados reais e isolamento de usuários.

## Pré-requisitos verificáveis

1. CI de `main` e das PRs comerciais aprovada.
2. Migrações `0040`–`0044` homologadas em **Preview comercial separado do Preview 4X**, sem alterações em produção.
3. `GAME_4X_SYSTEMS_ENABLED`, `LEVEL_PACKS_ENABLED`, `LEVEL_PACKS_PUBLIC_ENABLED`, `LEVEL_PACKS_PROPOSED_PRICES_APPROVED` mantidos desligados em produção.
4. `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` injetados somente como **Secrets** na instância isolada (nunca no `wrangler.jsonc` versionado).
5. `MP_PAYMENTS_ENABLED="true"` **apenas no staging isolado**, depois de validar os itens anteriores.
6. `NUBANK_PIX_ENABLED="false"` e `NUBANK_PIX_RECEIVER_VERIFIED="false"` no staging, salvo homologação separada.

## Matriz de aceitação (cada cenário exige log sanitizado)

| Cenário | Condição | Resultado esperado |
| --- | --- | --- |
| Sem configuração | Flag ausente ou `false`, credenciais presentes | `/api/store/payment-methods` retorna `mercadoPago:false`; checkout e apoio são recusados com 503 |
| Compra aprovada | Pedido autenticado, preço BRL exato, ordem do provedor processada | `purchase_requests` vai a `approved`; uma única concessão de gemas/itens; `mercadopago_orders` registra confirmação |
| Pagamento pendente | Ordem não processada ou sem valores pagos suficientes | `pending`; nenhuma concessão |
| Recusado ou cancelado | Status não processado | Nenhuma concessão; usuário recebe informação adequada |
| HMAC inválido | `x-signature` incorreta, `x-request-id` ausente ou timestamp expirado | HTTP 401; nenhuma consulta ao provedor nem escrita no D1 |
| Webhook duplicado | Repetir entrega da mesma ordem paga | Uma única concessão, sem mudança de saldo na repetição |
| Produto divergente | Preço, moeda, quantia de gemas ou external_reference divergente | Sem concessão; erro/pendência auditável |
| Duas compras one-time | Pacote P1, P2 ou P3 pago duas vezes em staging | Uma única concessão; segunda transação identificada para reconciliação/estorno |
| Contribuição voluntária | `/api/support/checkout` processada | `support_orders` muda de estado; **nenhuma gema** creditada |
| Pacote de apoio com gemas | Produto da tabela `vip_packages` (0040) | Concede gemas **somente** após confirmação, separado da contribuição voluntária |
| Estorno e chargeback | Provedor informa reembolso ou disputa | Caso marcado para reconciliação; não presumir reversão automática sem teste |
| Kill-switch | Desligar `MP_PAYMENTS_ENABLED` com order pendente | Novo checkout bloqueado; webhook de order existente continua verificável |

## Evidências exigidas para a autorização

Guardar em artefato privado com dados minimizados: SHA do commit e ambiente, migrações instaladas, log de execução, IDs internos sintéticos, status HTTP, valores antes/depois e resultado do teste. Rejeitar aprovação se qualquer cenário crítico falhar, se secrets constarem em logs ou se credenciais de produção tiverem sido usadas no staging.

### Comandos SQL exclusivamente read-only no Preview comercial

```sql
SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 10;
SELECT status, COUNT(*) AS quantidade FROM purchase_requests GROUP BY status ORDER BY status;
SELECT status, COUNT(*) AS quantidade FROM support_orders GROUP BY status ORDER BY status;
SELECT COUNT(*) AS ordens_confirmadas FROM mercadopago_orders;
SELECT COUNT(*) AS concessoes_nivel FROM level_pack_claims;
PRAGMA foreign_key_check;
```

Estas consultas exigem schema correspondente e acesso ao Preview comercial; não rodá-las contra produção sem uma auditoria read-only autorizada. Não copiar dados de jogadores em relatórios.

### Critério de GO

Somente após CI, Preview, Sandbox, auditoria de segurança, procedimentos de estorno e autorização do proprietário, criar uma mudança explícita e reversível para ativar `MP_PAYMENTS_ENABLED`. A mera presença de credenciais nunca equivale à homologação.

## Procedimento operacional detalhado (somente após autorização para staging)

**Não executar estes passos no Worker ou D1 de produção.** Não reutilizar o D1 Preview 4X da PR #319 para testes comerciais se seu histórico for incompatível. Preparar um Worker de homologação com domínio distinto, D1 isolado e descartável, log protegido e `ENVIRONMENT` identificando o ambiente, sem jogadores ou credenciais reais. O endereço e o UUID exatos serão definidos pelo operador e verificados **antes** de qualquer escrita. Não criar valores fictícios para eles.

1. **Conferir a aplicação Mercado Pago em Teste.** Abrir [Suas integrações](https://www.mercadopago.com.br/developers/pt), selecionar a aplicação de Orders, mudar o seletor para **Teste**, obter o **Access Token de teste** e configurar os usuários/contas de teste segundo a documentação oficial. Nunca usar vendedor e comprador reais para homologação. A conta compradora e a conta vendedora de teste devem ser do mesmo país.
2. **Obter a assinatura Webhooks de teste.** No painel da aplicação, configurar o tópico **Orders (`order`)**, cadastrar a **URL HTTPS pública do Worker de staging** terminando em `/api/webhook/mp` e obter o segredo de assinatura daquela configuração. Não cadastrar o endpoint de produção e não confundir `MP_WEBHOOK_SECRET` com o Access Token.
3. **Vincular secrets exclusivamente ao Worker de homologação:** `MP_ACCESS_TOKEN` = token de **teste** e `MP_WEBHOOK_SECRET` = segredo Webhooks de **teste**, ambos como *Secrets*, jamais no repositório, PRs, screenshots ou logs. Confirmar primeiro o binding `DB`, account ID e UUID do D1 de homologação; aplicar o histórico de migrações apropriado **somente após aprovação separada**, sem tocar produção. A instância de staging deve usar `MP_PAYMENTS_ENABLED="false"` até terminar o preflight de schema e configuração.
4. **Pré-teste de interrupção:** com ambos os secrets provisionados mas `MP_PAYMENTS_ENABLED="false"`, conferir `GET /api/store/payment-methods` → `mercadoPago:false`; `POST /api/store/checkout` e `POST /api/support/checkout` devem falhar **antes de escrever em D1**. O webhook de pedidos antigos permanece habilitado para conciliação de pedidos já existentes (com assinatura válida).
5. **Habilitar testes apenas no staging isolado:** colocar `MP_PAYMENTS_ENABLED="true"` exclusivamente no Worker de staging; manter `NUBANK_PIX_ENABLED`, `NUBANK_PIX_RECEIVER_VERIFIED`, `GAME_4X_SYSTEMS_ENABLED`, `LEVEL_PACKS_ENABLED`, `LEVEL_PACKS_PUBLIC_ENABLED` e `LEVEL_PACKS_PROPOSED_PRICES_APPROVED` desligados, salvo se houver homologação independente de cada sistema. Conferir `GET /api/store/payment-methods` → `mercadoPago:true,nubankPix:false`.
6. **Testar checkout com conta sintética do jogo e comprador de teste:** selecionar o `Pacote Inicial de Eldoria` (R$ 3,99, 35 gemas), criar `POST /api/store/purchase-request` com idempotência única e `paymentMethod:"mercadopago_link"`, depois `POST /api/store/checkout` com o `requestId` correspondente. Usar somente o `checkoutUrl` retornado pelo servidor, validado contra o domínio oficial do Mercado Pago, e simular o pagamento com os instrumentos de teste atuais do provedor. Não assumir que um resultado de cartão de teste é aplicável a todos os meios de pagamento.
7. **Conferir Orders e notificações:** verificar no painel de **Teste** que o evento `order` chegou ao endpoint de staging e consultar a Order de teste usando o Access Token de teste, para comparar `external_reference`, moeda `BRL`, total pago, estado `processed` e status local. **Não** forjar assinatura real no navegador ou compartilhar o secret. Se a notificação não chegar, tratar como falha; não marcar o teste como aprovado apenas porque o checkout exibiu sucesso.
8. **Executar cada cenário da matriz abaixo e registrar evidências:** preferir execução ponta a ponta com o Mercado Pago de Teste. Se o provedor não permitir produzir determinado estado (ex.: chargeback), usar teste sintético com mock do provedor e registrar **separadamente**, sem marcar a homologação externa como concluída.
9. **Encerrar staging:** confirmar nenhuma ordem incompleta ou reembolso pendente sem processo definido, voltar `MP_PAYMENTS_ENABLED="false"` no staging e preservar logs sanitizados. Nenhuma alteração no ambiente de produção decorre automaticamente da aprovação no staging.

### Sequência de testes de aceitação e evidências

| Caso | Ação no staging isolado | Prova exigida |
| --- | --- | --- |
| **G0** Credenciais sem ativação | Flag ausente ou `false`; tentar os dois checkouts e conferir método público | HTTP 503 em novos checkouts, `mercadoPago:false`, zero novas ordens |
| **G1** Compra aprovada | Pacote Inicial de Eldoria de R$ 3,99, pagamento com comprador de teste, evento `order` assinado | Ordem local `approved`; crédito de **35 gemas apenas uma vez**; conferir saldo anterior/posterior e ID interno da operação |
| **G2** Pendência | Simular pedido ainda não `processed` ou valor insuficiente | Ordem pendente e **zero crédito** |
| **G3** Recusa/cancelamento | Simular pagamento recusado ou cancelado | Nenhuma concessão, situação final ou pendente reconciliável |
| **G4** Assinatura inválida | Enviar notificação `type=order&data.id=...` com assinatura falsa para **staging** | HTTP 401, zero crédito e **nenhuma consulta** ao provedor nem escrita no D1 |
| **G5** Reentrega do mesmo webhook | Repetir um evento de pedido de teste já processado pelo canal autorizado | Idempotência: nenhuma gema duplicada, ausência de segundo grant |
| **G6** Divergência no valor | Ordem sintética cujo valor/BRL/reference não coincide com o pedido | Sem entrega e com motivo auditável |
| **G7** Contribuição voluntária | Comprar `/api/support/checkout` com tier `escudeiro` | Registro em `support_orders`; **nenhuma gema ou item** |
| **G8** Apoio com gemas | Produto `Apoio Escudeiro` originado em `0040`, compra real de teste | Crédito previsto de **500 gemas** somente após pagamento aprovado; ledger distinto da contribuição |
| **G9** Replay e concorrência | Repetir checkout/idempotency key e webhook, inclusive simultaneamente | Uma Order/concessão por operação; sem dois saldos para uma compra |
| **G10** Reembolso/disputa | Usar fluxo de estorno disponibilizado pelo provedor de teste ou fixture documentada | Incidente registrado, intervenção e reconciliação demonstradas; não presumir estorno automático de gemas |
| **G11** Pausa durante pedido pendente | Desativar `MP_PAYMENTS_ENABLED` depois da criação do pedido | Novo checkout bloqueado; webhook assinado da operação existente ainda pode conciliar |

### Evidência padronizada para cada cenário

Registrar em documento privado: **ambiente staging**, SHA do Worker, migração mais recente no D1, identificador interno sintético da operação, cenário G0–G11, estado inicial/final, HTTP esperado/observado, valores antes/depois de gemas e recursos, número de concessões e resultado PASS/FAIL/BLOQUEADO. Jamais publicar token, segredo HMAC, endereço bancário, dados pessoais, payload completo de pagamento ou credenciais de teste.

Consultas complementares **somente de leitura**, após confirmar o D1 isolado e a existência das tabelas:

```sql
SELECT status, COUNT(*) AS pedidos FROM purchase_requests GROUP BY status ORDER BY status;
SELECT status, COUNT(*) AS contribuicoes FROM support_orders GROUP BY status ORDER BY status;
SELECT id, status, product_name, price_brl, currency, gems_amount
  FROM purchase_requests WHERE id = ?;
PRAGMA foreign_key_check;
```

No último `SELECT`, usar exclusivamente um ID interno da conta sintética no staging; não publicar identificação de jogador. Para demonstrar crédito único, comparar saldos e ledgers internos em duas consultas read-only antes e depois do webhook. **Nunca** usar `UPDATE`, `DELETE`, `INSERT` ou `ALTER` manualmente para simular aprovação; o teste deve passar pelo Worker e pelo provedor/mocks.

### Gate de ativação controlada de produção

Só propor o merge de código e futura ativação quando estiverem documentados: CI da PR #322 e da main aprovadas; proteção de branch e ambiente; D1 comercial homologado **sem migrações históricas divergentes**; G0–G11 com evidências e plano formal para falhas que o provedor não reproduzir; autenticação, HMAC, idempotência e conciliação auditados; fluxos Pix/manual revisados separadamente; jogo web testado em celular de baixa memória; monitoramento de pedidos, atendimento e estornos definidos; consentimento explícito do proprietário. Mesmo que esse checklist passe, **a ativação exige uma mudança separada, revisável e reversível**, nunca automático pelo cadastro dos secrets.

Referências oficiais: [Mercado Pago — testar checkout Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/cards), [Mercado Pago — notificações Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications), [Cloudflare — ambientes de staging](https://developers.cloudflare.com/workers/wrangler/environments/).
