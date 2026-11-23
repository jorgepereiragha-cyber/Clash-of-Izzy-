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
