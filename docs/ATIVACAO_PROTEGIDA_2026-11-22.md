# Clash of Izzy — Ativação protegida (auditoria de 22/11/2026)

> Documento operacional, **não** uma autorização automática de deploy, migração, cobrança ou release.

## Evidências e situação real

- `main`: `9c730291c2edddd2e542ac246cbd69852137f92b`. CI pós-merge #45091696499 concluída com sucesso; **CI não prova saúde em produção**.
- Última auditoria remota disponível: #45083819849 falhou com `/api/health` HTTP 503. D1 produção: histórico de 39 migrações até 0036 e ausência de `daily_reward_claims`, `onboarding_bonus_claims`, `support_orders`. Não existe comprovação de `repair-production-d1-core.yml` executado.
- D1 Preview: #45084368945 confirmou 44/44 migrações até 0041, zero jogadores e tabelas obrigatórias presentes.
- **4X HTTP já foi testado em Preview**, conforme `docs/4X_HOMOLOGACAO_REAL_2026-11-22.md` e runs #45031813620 e #45032336540. Revalidar quando código/dependências mudarem e antes de promover a flag em produção.
- API de releases oficial: `/releases/latest` ainda HTTP 404. APK interno/debug não substitui APK oficial assinado.
- A integração vigente da loja usa `mercadoPago` e `nubankPix`. **NuPay for Business não é sinônimo de Pix Nubank**; não anunciar integração NuPay sem implementação e homologação específicas.

## Ordem mínima para destravar o jogo gratuito, sem receber dinheiro

1. Responsável da operação confirma janela de manutenção, `main` testada, ambiente `production`, isolamento Preview e Time Travel. A execução está sujeita a novo preflight.
2. Executar **somente** [Reparar D1 essencial 0037–0039](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/repair-production-d1-core.yml): `confirm_production=true`, `confirm_preview=true`, UUID `7e63af59-d9ff-4159-a9cf-b02e35b92605`. Obter aprovação do ambiente protegido quando solicitada.
3. Exigir log de verificação read-only do histórico, schema e `PRAGMA foreign_key_check`, além do bookmark Time Travel arquivado **antes** do primeiro write. Após aplicação, verificar o registro apenas de 0037–0039, as três tabelas e `/api/health` HTTP 200 com `status=ready`, `checks.database/schema/session=true` e `missingTables=[]`.
4. Só então executar [Deploy Worker-only](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/deploy-worker-only.yml) na `main` com aprovações; não executar `deploy-cloudflare.yml` como atalho. Revalidar saúde 200, autenticação e recuperação de sessão, conta Master protegida, stats e navegação.
5. Testar instalação real em Android e acesso ao reino. **O workflow oficial `publicar-apk-android.yml` ainda exige catálogo e pagamentos habilitados.** O fluxo gratuito alternativo da PR #258 permanece draft; não afirmar que o APK gratuito já pode ser lançado com o workflow comercial atual.

## Segurança do D1

- `d1_migrations` é um histórico de aplicação e não deve ser alterado manualmente para 'resolver' erros. Se o schema divergir do ledger, bloquear a operação e investigar todas as tabelas, índices, constraints e a execução parcial com administrador responsável.
- Não aplicar 0040–0044 em lote, não efetuar `wrangler d1 export` improvisado com FTS5 e **não restaurar Time Travel sem plano**: restore substitui dados que possam ter sido gravados depois do bookmark.
- O gate `PRAGMA foreign_key_check` é leitura documentada pela Cloudflare D1. Qualquer referência inválida deve impedir o reparo até investigação.
- Não desabilitar `GAME_4X_SYSTEMS_ENABLED`/flags financeiras como 'atalho'; a flag 4X deve permanecer `false` até a presença do schema 0041 em produção com deploy e rollback planejados.

## Catálogo, pagamentos e sistemas 4X

- **Mercado Pago**: existe implementação de Checkout Orders com `X-Idempotency-Key`, verificação `x-signature` e conciliação no Worker. Testes simulados não substituem uma transação sandbox/produção controlada, estados aprovado/recusado/pendente, reembolso e verificação de concessão única. Tokens nunca devem ser incluídos no GitHub.
- **Pix Nubank**: configuração pública `nubankPix` não equivale a checkout NuPay. Confirmar caminho real de recebimento, titularidade e conciliação antes de habilitar.
- **NuPay for Business**: se for escolhido como novo meio, necessita implementação contratual separada (checkout, credenciais, callbacks, idempotência e homologação). Não basta alterar variável.
- **4X**: a função não exige pagamentos como dependência técnica por padrão, mas exige schema 0041 e sistema de jogo validado. Migrar exclusivamente componentes necessários com plano próprio, testes em Preview e no pós-deploy, monitoramento e rollback.

## Links de auditoria

- [Issue P0 #269](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/issues/269)
- [CI main](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45091696499)
- [Cloudflare: D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare: PRAGMA foreign_key_check](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [Cloudflare: Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Mercado Pago: webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications)
- [NuPay for Business: API](https://docs.nupaybusiness.com.br/checkout/docs/openapi/index.html)
