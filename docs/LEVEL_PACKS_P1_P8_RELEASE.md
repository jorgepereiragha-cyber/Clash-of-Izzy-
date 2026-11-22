# Clash of Izzy — Pacotes P1–P8 (0042–0044): homologacao antes de comercializar

## Escopo implementado
- Revisao do catalogo empilhada sobre a PR #236, que depende da #233, #229 e #223; nao executa qualquer migracao remota, deploy ou pagamento.
- Reutiliza `vip_packages`, `purchase_requests`, o checkout `/v1/orders` e o webhook HMAC existentes.
- Pacotes novos diferenciados pelo nome canonico em `level-packs.js`, com limiar de progressao 10,20,...80. P1-P8 do jogo permanecem separados de VIP 1-7.
- Gemas creditadas exclusivamente em `players.gems`; madeira, comida, pedra, ferro e ouro em `kingdoms`.
- `level_pack_claims` reserva uma concessao por (kingdom_id,pack_level); insercao, gemas e recursos dentro do D1.batch transacional existente.
- `LEVEL_PACKS_ENABLED` **desligado por padrao**. Novas ofertas nao aparecem no catalogo nem admitem checkout quando a flag esta ausente.
- Liberacao granular: habilitar `GAME_4X_SYSTEMS_ENABLED=true`, `LEVEL_PACKS_ENABLED=true` e `LEVEL_PACKS_TEST_PLAYER_IDS` como lista de IDs publicos de teste, separados por virgula. Enquanto `LEVEL_PACKS_PUBLIC_ENABLED` nao for `true`, apenas essa allowlist pode visualizar/criar checkout. **Nunca habilitar publico sem checklist concluido**.
- O cliente envia o token autenticado ao consultar `/api/store/catalog`; nenhum token deve aparecer no HTML ou nos logs.
- A compra de pacote por nivel depende de sessao autenticada, nivel real de `kingdom_progression` no D1, preco e gemas congruentes com a configuracao, e Mercado Pago configurado. Pix manual e aprovacao manual nao criam novos pedidos de nivel.
- Se dois pedidos pagos distintos tentarem reivindicar a mesma faixa, a concessao nao se repete. A segunda order fica sem `fulfilled_at` e demanda conciliacao/estorno manual; nao prometer reembolso automatico.

## Valores do protocolo de 22/11/2026 (ainda bloqueados para venda)
- P1: R$9,90 · 500 gemas; P2: R$29,90 · 2.000 gemas; P3: R$59,90 · 5.000 gemas.
- P4: R$99,90 · 10.000 gemas; P5: R$149,90 · 20.000 gemas; P6: R$199,90 · 35.000 gemas.
- P7: R$299,90 · 60.000 gemas; P8: R$499,90 · 100.000 gemas.
Os recursos de cada fase estao em `level-packs.js`, nao na tabela `vip_packages`. O usuario forneceu os valores, mas **a liberacao comercial continua condicionada** a testes de checkout, aprovacao e flags: `LEVEL_PACKS_PROPOSED_PRICES_APPROVED` nao deve ser ativada automaticamente.
A PR #238 originalmente propunha `0043_align_level_pack_catalog.sql` com UPDATE incondicional por nome; essa variante foi RETIRADA na correção de segurança. A PR #236 tem `0043_fix_vip_catalog.sql`, que atua somente sobre preco+gemas antigos conhecidos. A nova `0044_reconcile_level_packs.sql` usa pares legados exatos, preserva valores personalizados e nao altera o pacote se houver `purchase_requests` com status `pending` para o seu `product_id`. Se `0043_fix` ja corrigiu a linha, `0044` nao altera nada. A migracao `0044` nao recupera alteracoes indevidas que outra `0043` ja tenha feito; NAO aplicar duas variantes de `0043`. Antes de qualquer execucao remota, consultar pedidos pendentes e confirmar os dados reais no D1 Preview. Se existirem Orders em processamento ou preco divergente, conciliar com o provedor antes de ativar vendas. E fundamental inspecionar as cinco linhas e os IDs antes e depois; UPDATEs condicionais podem ser no-op sem produzir erro. O SQL de 0044 nao altera pedidos historicos e nao garante por si so uma migracao comercial aprovada.
Atribuicoes e quantidades definitivas devem ser revisadas para equilibrar a economia, protecao do consumidor e nao prometer itens nao entregues.
Nenhuma flag pode ser ativada antes da aprovacao comercial de TODOS os valores vigentes.

## Checklist de liberacao
1. PR #223 revista e aprovada; #229 homologada e revisada. Rebase/retarget desta PR apos a ordem de merges. Validar testes e conflitos antes de qualquer merge.
2. Criar backup D1 de producao, verificar integridade e capacidade de restaurar. Conferir nomes de tabelas e migracoes atuais de producao e preview, sem inferir a partir de documentacao antiga.
3. Aplicar `0037–0044` em ordem e apenas quando houver UMA variante canonica de `0043`, com a `0044` condicional somente via pipeline protegido aprovado, apos teste em Preview. Obter evidencias `PRAGMA table_info` e SELECT de valores e indexes relevantes. Nunca rodar comandos de producao automaticamente.
4. Rodar `node --test tests/level-packs.test.js tests/mercadopago-4x-integration.test.js`, `npm test`, `npm run check` e testes Android. O teste simulado **nao substitui** pagamento real do Sandbox do provedor.
5. Configurar credenciais Mercado Pago de teste apenas em ambiente isolado, validar autenticacao do webhook, divergencia de valores, replay e pagamento duplicado entre pedidos distintos. Usar dados sinteticos; verificar os balances efetivos no D1 Preview.
6. Testar troca de fase P1–P8, niveis 9/10, 19/20, 79/80, compra unica, concorrencia, compra pendente, pagamento recusado, cancelamento, disputa e estorno. Verificar que a ordem duplicada exige conciliacao.
7. Revisar UX da loja, acessibilidade, desempenho e APK assinado em Android fisico. Não declarar Android apto apenas por emulador.
8. Ativar `GAME_4X_SYSTEMS_ENABLED=true` em staging primeiro, e depois `LEVEL_PACKS_ENABLED=true` com `LEVEL_PACKS_TEST_PLAYER_IDS` definido apenas para contas de teste. Confirmar que outras contas nao visualizam nem criam checkout. `LEVEL_PACKS_PUBLIC_ENABLED=true` autoriza o publico e deve permanecer ausente ate homologacao completa. Antes disso, `LEVEL_PACKS_PROPOSED_PRICES_APPROVED=true` so pode ser configurado apos aprovacao dos precos P4-P8.
9. Confirmar forma de rollback de Worker e flags; monitorar logs e saldos por 24h ou janela aprovada; liberar ao publico somente apos evidencias.

## Nota de segurança
Nao publicar MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, chaves Pix, credentials Cloudflare ou keystores.
A API do Mercado Pago Orders usa `X-Idempotency-Key` e webhook assinado. O identificador comercial do pedido e o preco sao gerados pelo servidor; nao usar `external_reference` recebido do browser como identidade confiavel do jogador.

Referencias: docs/PAGAMENTOS_MERCADO_PAGO.md e docs/4X_PREFLIGHT_PRODUCAO.md.
