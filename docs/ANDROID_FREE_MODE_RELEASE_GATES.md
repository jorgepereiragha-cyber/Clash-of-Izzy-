# Clash of Izzy — APK gratuito: diagnóstico não é autorização de publicação

## Estado
Esta PR adiciona somente a consulta **read-only** `scripts/check-android-free-release.mjs` para diagnóstico da configuração pública. Ela **não habilita modo gratuito oficial, não publica APK, não altera pagamentos e não toca no D1**.

A consulta `GET /api/store/payment-methods` retornando `mercadoPago:false` e `nubankPix:false` indica apenas o estado público informado para esses dois meios de pagamento. **Não comprova**, isoladamente, que:
- todas as rotas de checkout, pedidos legados, doações/apoios, Pix e concessões automáticas estão desativadas do lado do Worker;
- algum outro provedor ou método de pagamento esteja indisponível;
- credenciais, webhooks e ordens pendentes estejam conciliados;
- a distribuição via APK atende a política comercial aprovada;
- um usuário não consegue criar pedidos, receber gemas ou gastar dinheiro por caminhos alternativos.

## Contrato oficial preservado
O workflow `.github/workflows/publicar-apk-android.yml` **mantém os dois gates `scripts/check-commercial-store.mjs`** (antes da assinatura e imediatamente antes da publicação). Ainda exige acionamento manual na `main`, certificado de release aprovado, APK `assembleRelease` assinado, validação `apksigner`, SHA-256, checagem do backend publicado e versão inédita.

**Nunca** substituir o gate do workflow por `check-android-free-release.mjs` apenas para deixar a CI verde. Uma distribuição gratuita operacionalmente segura exige um modo de negócio próprio, revisto e aprovado, com testes de contrato de *todas* as rotas financeiras (não só do endpoint público), comportamento fail-closed do Worker, identidade do APK e homologação em Android físico.

## Assinatura
O arquivo Gradle real é `android-sideload/app/build.gradle`; os nomes de ambiente de build são `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`, injetados pelo workflow após validar secrets de release. Sem assinatura válida, a publicação deve **falhar**. Não adicionar fallback para `debug.keystore`, senhas `android` ou `androiddebugkey` em `buildTypes.release`.

## D1 Preview e Sandbox
`npx wrangler dev --remote` sem configuração isolada não seleciona magicamente o banco Preview: `wrangler.jsonc` inclui binding `DB` do banco de **produção**. Antes de testar remotamente, confirmar uma configuração dedicada cujo **único** binding D1 aponta para `izzy-preview-17112026` (`6674c0ac-3636-4e57-bff8-23cf60ab9637`), sem DO/segredos produtivos, e obter autorização explícita para dados sintéticos.

Para validar um pedido P1, utilizar a consulta **por jogador e Order específica** em `docs/4X_SANDBOX_CHECK_SQL.md`. Uma linha SQL, por si só, não comprova idempotência: comparar saldos antes/depois, confirmar status pela API Sandbox do Mercado Pago e repetir webhook autenticado sem novos créditos.

## Próximo gate
Executar `Cloudflare Paid Readiness (read-only)` na `main`, com `owner_confirmed_paid_plan=false` se ainda não verificado. Inspecionar logs da execução autenticada, UUIDs e Time Travel antes de autorizar migração de Preview; não ativar flags de produção.
