# Clash of Izzy — preflight da última milha 4X

Data: 2026-11-22. **A PR #229 é Draft e depende da PR #223. Não liberar em produção com este documento isoladamente.**

## Estado comprovado vs. pendente

- D1 Preview recebeu 0037–0041 e passou testes HTTP; D1 produção foi auditado **somente leitura** e parou em 0036.
- Os scripts WebGL já possuem descarte de geometrias/materiais, fallback 2D, LOD e `__coiKingdomDiagnostics()`; não duplicar componentes.
- Gems/diamantes são canonicamente `players.gems`; comida, madeira, pedra, ferro, ouro ficam em `kingdoms`. Não reescrever o webhook para `kingdoms.gems` (coluna inexistente).
- Mercado Pago processa Orders em `mercadopago-orders.js` com HMAC, validação remota de valor e ledger por `order_id`. A lista de IDs de pagamento fica em `mercadopago_orders.payment_ids_json`; não existe razão para inventar coluna `mp_payment_id` no banco.
- Testes HMAC usam provedor simulado; Mercado Pago sandbox real não homologado.

## 1. Protecao do D1 antes de qualquer migração (sem export manual)

O comando antigo `scripts/backup-d1-production.sh` **foi desativado**, com falha explicita. A exportacao por `wrangler d1 export --remote` nao e um checkpoint de recuperacao aprovado para este banco com tabelas FTS5: o formato de exportacao de tabelas virtuais compativel com `sqlite3_cli_only` nao pode ser importado de volta no D1.

1. Acesse GitHub Actions → **Cloudflare Paid Readiness (read-only)** e execute na `main`, deixando o Workers Paid desmarcado caso ainda nao comprovado. Inspecione UUIDs de producao/Preview, migracoes e disponibilidade Time Travel.
2. Com GO comercial aprovado, o **unico** deploy remoto indicado e o workflow `deploy-cloudflare.yml` manual, na `main`, com `confirm_paid_plan=true` e `confirm_production=true` e aprovacoes do ambiente `production`, quando aplicaveis.
3. Esse workflow captura e arquiva o bookmark de Time Travel ANTES de aplicar as migrações remotas e publicar. A existencia de um bookmark nao prova restore funcional; a retencao e a recuperacao dependem do plano e da janela.
4. Nao executar restore de producao sem protocolo de incidente e autorizacao, pois ele sobrescreve transacoes posteriores.

Documentacao oficial: https://developers.cloudflare.com/d1/reference/time-travel/ e https://developers.cloudflare.com/changelog/post/2026-11-12-d1-export-virtual-tables/.

## 2. Preflight de esquema (somente leitura)

```bash
npx wrangler d1 migrations list clash-of-izzy-db --remote
npx wrangler d1 execute clash-of-izzy-db --remote --command "SELECT id,name,applied_at FROM d1_migrations ORDER BY id DESC LIMIT 8"
npx wrangler d1 execute clash-of-izzy-db --remote --command "SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('daily_reward_claims','onboarding_bonus_claims','support_orders','intermediate_resources','city_defenses','kingdom_progression','progression_xp_ledger') ORDER BY name"
npx wrangler d1 execute clash-of-izzy-db --remote --command "PRAGMA foreign_key_check"
```

Rever os resultados **antes** de qualquer `apply`: `CREATE TABLE IF NOT EXISTS` não comprova que um objeto preexistente possui o esquema esperado. As migrações 0037–0041 atuais **não** incluem `ALTER TABLE`; 0040 usa `INSERT OR IGNORE`. Mesmo assim, índice com nome preexistente, tabela divergente, dados conflitantes ou migrações manualmente aplicadas podem causar falhas. Não editar SQL de migrações já registradas. Se encontrar divergência, interromper e planejar migração corretiva incremental.

## 3. Aplicação somente pelo workflow manual protegido

Pré-requisitos: integrar as PRs em ordem, CI verde no SHA atual, auditar D1 Preview remoto sem ambiguidades, homologar Mercado Pago Sandbox em ambiente separado, testar Android físico e registrar GO comercial.

Nao executar `wrangler d1 migrations apply clash-of-izzy-db --remote` no terminal. Esse comando seleciona o D1 de **producao** e ignora os gates do workflow.

Para publicar, apenas depois de todos os gates: GitHub Actions → **Deploy Clash of Izzy to Cloudflare** → `Run workflow` → branch `main` → marcar **ambas** as confirmacoes `confirm_paid_plan` e `confirm_production`. Uma caixa desmarcada ignora integralmente o job, nao e modo de homologacao. A etapa de migracoes remotas do workflow somente ocorre apos captura/arquivo do Time Travel.

Com flags `GAME_4X_SYSTEMS_ENABLED`, `LEVEL_PACKS_ENABLED`, `LEVEL_PACKS_PUBLIC_ENABLED` e `LEVEL_PACKS_PROPOSED_PRICES_APPROVED` desligadas, nem a aprovacao de CI nem a fusao das PRs liberam o comercio. Ativacao publica exige gate financeiro e revisao de preco, com rollout progressivo, nao mudanca direta das quatro flags na `main`.

## 4. Android físico e indicadores 3D

- A CI e emulador não representam um dispositivo real. Instalar o APK assinado com fingerprint verificado e exercitar o jogo por pelo menos 15 minutos, com atenção ao aquecimento, troca de orientação, navegação, reconexão e WebGL.
- Cinco pontos a monitorar: (1) geometria/material ao atualizar edifícios, (2) GLB e texturas armazenados em cache, (3) mixers e `requestAnimationFrame` quando a página fica oculta, (4) listeners/observers ao perder WebGL, (5) ImageBitmap/texturas e shaders no fallback 2D.
- O `window.__coiKingdomDiagnostics()` já informa draw calls, geometrias e texturas. O overlay de FPS só aparece quando `window.ENVIRONMENT === "development"` estiver definido **antes** do carregamento do módulo 3D; `ENVIRONMENT` do Worker não é automaticamente uma variável JavaScript do navegador.
- O indicador mostra um traço (—) quando não há frames animados suficientes. FPS por `requestAnimationFrame` não mede duração na GPU; validar também via `chrome://inspect` ou profiler WebGL em um dispositivo físico.
- Os canvases do grid e da defesa usam `pointerdown` e CSS `touch-action:none`; `touchstart/touchmove` não estão implementados nesses módulos. Fora dos canvases, a rolagem continua normal.

## 5. Pagamentos 4X — checklist de homologação

- Registrar URL de webhook correta e chave HMAC real no ambiente sandbox do Mercado Pago, sem revelar tokens.
- Criar pedido de teste, confirmar status por API oficial e verificar a ligação de `purchase_requests.player_id`, `purchase_requests.kingdom_id` e `mp_order_id`.
- Conferir valor BRL, evento `order.processed`, assinatura, correspondência com pedido e `mercadopago_orders.order_id`. Repetir a notificação deve causar **zero** créditos adicionais.
- Para `vip_package`, gemas são creditadas a `players.gems` como definido no projeto; benefícios Master adicionam mudanças relacionadas ao reino conforme `master-pack.js`. Não transferir gemas para tabela de recursos sem redesign transacional.
- Testar rejeições: valor divergente, moeda errada, assinatura inválida, pedido desconhecido, duplicação/replay e indisponibilidade do provedor.
- Não estabelecer SLA de "menos de 5 segundos" antes de telemetria real; processamento assíncrono do provedor e rede variam.

Referências oficiais:
- https://developers.cloudflare.com/workers/wrangler/commands/d1/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/optional-notifications
