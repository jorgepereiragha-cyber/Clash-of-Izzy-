# Free-first sem novos pedidos — plano de homologação (23/11/2026)

## Alteração proposta
A branch `feat/free-first-payment-lock-20261123` implementa a opção comercial **B: jogo gratuito primeiro** de forma explicitamente opt-in, sem enfraquecer os gates existentes.

A flag de ambiente `GAME_FREE_FIRST_MODE_ENABLED="true"` (string exata) faz o Worker rejeitar, antes de qualquer nova escrita de pedido, todos os POSTs de cobrança conhecidos:
- `/api/store/checkout` (Mercado Pago)
- `/api/support/checkout` (apoios)
- `/api/store/purchase-request` (inclusive `manual_whatsapp`, Mercado Pago e Pix)
- `/api/store/pix-instructions`

Cada tentativa bloqueada recebe HTTP 503 e `FREE_FIRST_PAYMENTS_DISABLED`. O GET `/api/store/payment-methods` indica explicitamente `freeFirstMode: true` e dois meios desabilitados, ainda que existam credenciais legadas.

**Sem a flag**, a configuração anterior permanece inalterada; apenas ausência de credenciais não ativa free-first. Nenhum deploy ou mudança de `wrangler.jsonc` é realizado nesta PR.

## Obrigações e limites
- Webhooks Mercado Pago e rotas administrativas existentes não são desligados: pedidos históricos legítimos podem exigir conciliação/estorno; não declarar que não existiram transações.
- Compras em moeda **virtual** do próprio jogo não são bloqueadas por esta política.
- Catálogo atual e interface da loja podem continuar exibindo preços; a UX de free-first precisa ocultar/indicar indisponibilidade de ofertas pagas antes da distribuição.
- O script `check-android-free-release.mjs` é somente diagnóstico, não uma autorização para publicar; a PR não substitui os **dois** gates comerciais do workflow de release Android.
- As flags de outros modos de cobrança, suporte e equipamentos devem ser auditadas antes de habilitar o modo em produção.
- Mudança de Worker afeta navegador e APK, pois ambos usam o mesmo backend. Não alterar D1 de produção para validar.

## Critérios para liberar APK gratuito
1. CI e testes completos verdes, inclusive `tests/free-first-payment-policy.test.js`.
2. Fluxos de pedidos pagos testados em Preview com D1 isolado e flag ligada/desligada; 0 pedidos novos criados sob flag ligada.
3. Retomar o contrato público em GET de produção, com `freeFirstMode:true` **após deploy protegido e autorizado**, comprovando que está realmente ativo.
4. Testar SDK Android em aparelho físico, ingressar no reino, marchas, progressão e falha controlada dos botões financeiros.
5. Somente depois propor PR separada alterando o gate oficial de APK para liberar 1.0.0 gratuito com dois checks de modo free-first antes da publicação, sem relaxar assinatura, SHA-256, D1, testes e aprovação humana.

As migrações 0040+ e o PvP não são autorizados por esta mudança.