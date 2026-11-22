# Clash of Izzy — Pacotes P1–P8 (0042): homologacao antes de comercializar

## Escopo implementado
- Branch empilhada sobre PR #229; nao executa qualquer migracao remota, deploy ou pagamento.
- Reutiliza `vip_packages`, `purchase_requests`, o checkout `/v1/orders` e o webhook HMAC existentes.
- Pacotes novos diferenciados pelo nome canonico em `level-packs.js`, com limiar de progressao 10,20,...80. P1-P8 do jogo permanecem separados de VIP 1-7.
- Gemas creditadas exclusivamente em `players.gems`; madeira, comida, pedra, ferro e ouro em `kingdoms`.
- `level_pack_claims` reserva uma concessao por (kingdom_id,pack_level); insercao, gemas e recursos dentro do D1.batch transacional existente.
- `LEVEL_PACKS_ENABLED` **desligado por padrao**. Novas ofertas nao aparecem no catalogo nem admitem checkout quando a flag esta ausente; pedidos pendentes tambem nao abrem checkout com a flag desligada.
- A compra de pacote por nivel depende de sessao autenticada, nivel real de `kingdom_progression` no D1, preco e gemas congruentes com a configuracao, e Mercado Pago configurado. Pix manual e aprovacao manual nao criam novos pedidos de nivel.
- Se dois pedidos pagos distintos tentarem reivindicar a mesma faixa, a concessao nao se repete. A segunda order fica sem `fulfilled_at` e demanda conciliacao/estorno manual; nao prometer reembolso automatico.

## Precos para aprovar
Valores P1-P3 fornecidos: P1 R$9,90; P2 R$29,90; P3 R$59,90.
**P4-P8 sao PROPOSTAS NAO APROVADAS**: P4 R$89,90; P5 R$129,90; P6 R$179,90; P7 R$229,90; P8 R$299,90.
Atribuicoes e quantidades definitivas devem ser revisadas para equilibrar a economia, protecao do consumidor e nao prometer itens nao entregues.
Nenhuma flag pode ser ativada antes da aprovacao comercial de TODOS os valores vigentes.

## Checklist de liberacao
1. PR #223 revista e aprovada; #229 homologada e revisada. Rebase/retarget desta PR apos a ordem de merges. Validar testes e conflitos antes de qualquer merge.
2. Criar backup D1 de producao, verificar integridade e capacidade de restaurar. Conferir nomes de tabelas e migracoes atuais de producao e preview, sem inferir a partir de documentacao antiga.
3. Aplicar `0037–0042` sequencialmente somente via pipeline protegido aprovado, apos teste em Preview. Obter evidencias `PRAGMA table_info` e SELECT de valores e indexes relevantes. Nunca rodar comandos de producao automaticamente.
4. Rodar `node --test tests/level-packs.test.js tests/mercadopago-4x-integration.test.js`, `npm test`, `npm run check` e testes Android. O teste simulado **nao substitui** pagamento real do Sandbox do provedor.
5. Configurar credenciais Mercado Pago de teste apenas em ambiente isolado, validar autenticacao do webhook, divergencia de valores, replay e pagamento duplicado entre pedidos distintos. Usar dados sinteticos; verificar os balances efetivos no D1 Preview.
6. Testar troca de fase P1–P8, niveis 9/10, 19/20, 79/80, compra unica, concorrencia, compra pendente, pagamento recusado, cancelamento, disputa e estorno. Verificar que a ordem duplicada exige conciliacao.
7. Revisar UX da loja, acessibilidade, desempenho e APK assinado em Android fisico. Não declarar Android apto apenas por emulador.
8. Ativar `GAME_4X_SYSTEMS_ENABLED` no ambiente de teste primeiro. Somente depois, ativar `LEVEL_PACKS_ENABLED` nas contas de homologacao. **A flag atual e global**; segmentacao por administrador exige mecanismo adicional e NAO esta implementada por esta PR.
9. Confirmar forma de rollback de Worker e flags; monitorar logs e saldos por 24h ou janela aprovada; liberar ao publico somente apos evidencias.

## Nota de segurança
Nao publicar MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, chaves Pix, credentials Cloudflare ou keystores.
A API do Mercado Pago Orders usa `X-Idempotency-Key` e webhook assinado. O identificador comercial do pedido e o preco sao gerados pelo servidor; nao usar `external_reference` recebido do browser como identidade confiavel do jogador.

Referencias: docs/PAGAMENTOS_MERCADO_PAGO.md e docs/4X_PREFLIGHT_PRODUCAO.md.
