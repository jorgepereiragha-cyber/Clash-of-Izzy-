# Clash of Izzy — beta fechado isolado (primeira entrega)

## Situação e proteção

Este pacote é um **esqueleto de implantação**. Nenhuma base remota foi criada, nenhum deploy foi realizado, nenhum APK foi assinado, nenhum pagamento foi habilitado.

| Ambiente | Worker | D1 | Android |
| --- | --- | --- | --- |
| Produção | `clash-of-izzy` | `clash-of-izzy-db` | `com.clashofizzy.android` |
| Preview descartável | isolamento previsto no `wrangler.jsonc` | `izzy-preview-17112026` | nenhum APK comercial |
| Beta fechado | `clash-of-izzy-beta` | **NOVO** `clash-of-izzy-beta-db` | `com.clashofizzy.android.beta` |

O `wrangler.beta.jsonc` contém `REPLACE_WITH_NEW_BETA_D1_UUID` propositalmente e **não deve ser publicado** até que um banco novo tenha sido criado e o UUID comprovado. Nunca copiar UUIDs de produção ou Preview.

O Worker beta usa `assets.run_worker_first=true` para que HTML, arquivos estáticos, API e WebSocket sejam filtrados antes da entrega. O acesso fica fechado se `INVITE_ONLY` não for `true`, faltar D1 ou ocorrer erro no banco. `/api/health` fica acessível apenas para diagnóstico sem informações de jogador. Um código de convite é usado para obter uma sessão segura e limitada ao navegador; o código não substitui autenticação de conta. **Nesta versão, acesso não está vinculado individualmente à conta do jogador** — restringir convite a cada conta e revogação por usuário é etapa posterior.

## Branch independente de implementação

A fonte da versão fechada vive na branch `beta`, derivada da `main` sem alterar a produção. Os workflows beta devem ser acionados **na branch `beta`** e não em `main`. O workflow de deploy da produção permanece protegido e separado. Revisar a versão exata da branch antes de copiar o código para qualquer Worker.

## Provisionamento guiado por GitHub Actions (novo)

A opção mais segura para iniciar é o workflow manual **[Beta fechado - auditar ou criar D1 exclusivo](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/provision-beta-d1.yml)**. Ele fica na branch `main` apenas por ser a branch padrão de acionamento do GitHub; **não faz deploy nem altera o Worker da produção**. Lê `wrangler.jsonc` da `main` e `wrangler.beta.jsonc` da branch `beta` como dados, sem executar código da branch beta com credenciais Cloudflare.

Antes de acionar:
1. Criar/revisar o ambiente de aprovação `beta-infrastructure` em **Settings → Environments**, restringindo acesso a mantenedores autorizados e exigindo aprovação humana quando disponível.
2. Configurar o secret **`CLOUDFLARE_BETA_D1_TOKEN`** no ambiente `beta-infrastructure` com permissão **D1 Write** na conta Cloudflare, sem permissões Workers/Secrets. A permissão D1 Write é da conta, não de um banco individual; o workflow restringe as operações efetivas a GET de listagem e POST de criação com nome beta. Não reutilizar a credencial de produção.
3. Ter `CLOUDFLARE_ACCOUNT_ID` disponível para o workflow como secret (no repositório ou no ambiente).
4. Em **Actions → Beta fechado - auditar ou criar D1 exclusivo → Run workflow**, selecionar branch `main` e `operation=audit` primeiro. Essa etapa não escreve nada e informa se o terceiro banco já existe.
5. Só se a auditoria confirmar que o D1 ainda não existe, selecionar `operation=create` e digitar **`CRIAR-D1-BETA`** em `confirm_new_beta_only`. O padrão `location_hint=enam` solicita localização inicial na América do Norte Oriental; é apenas uma preferência geográfica, não residência de dados garantida.
6. Copiar o UUID do **Step Summary** do workflow, conferir que é diferente dos IDs de produção/Preview e atualizar somente `wrangler.beta.jsonc` na branch `beta` após revisão. Não é preciso enviar tokens ou senhas pelo chat.

Este workflow não aplica migrações, não configura secrets do Worker beta, não cria convites, não faz deploy e não altera D1s anteriores. Se o nome `clash-of-izzy-beta-db` já existir, a auditoria apenas informa seu UUID; o modo de criação recusa duplicatas. Configurar a branch `beta` e as credenciais beta continua sendo uma etapa distinta.

## Operações manuais (somente após revisão e CI)

1. Criar **terceiro** D1 no Cloudflare: `npx wrangler d1 create clash-of-izzy-beta-db`. Guardar o novo ID retornado e verificar que não coincide com produção nem Preview.
2. Substituir `REPLACE_WITH_NEW_BETA_D1_UUID` somente em `wrangler.beta.jsonc` por esse ID; revisar diff antes do deploy. Não alterar o `wrangler.jsonc` oficial.
3. Preparar secrets exclusivos do Worker beta com `npx wrangler --config wrangler.beta.jsonc secret put SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` e demais dependências essenciais de autenticação conforme auditoria. Não reutilizar o segredo de sessão da produção. Não configurar tokens de pagamento live nesta fase.
4. Executar apenas no D1 beta as migrações comuns: `npx wrangler --config wrangler.beta.jsonc d1 migrations apply clash-of-izzy-beta-db --remote`. Depois, executar **somente nele** `npx wrangler --config wrangler.beta.jsonc d1 execute clash-of-izzy-beta-db --remote --file beta/schema.sql`. Confirmar IDs de conta e database antes de ambos os comandos.
5. Gerar convites **localmente, fora de CI/logs públicos**: `node beta/generate-invites.mjs 3 1 7` (três convites, uso único, sete dias). O script imprime códigos privados e statements SQL apenas com SHA-256. Executar os statements individualmente no D1 beta, por exemplo pelo console do banco beta. Nunca publicar códigos.
6. Revisar `npx wrangler --config wrangler.beta.jsonc deploy --dry-run`; publicar o Worker beta apenas após confirmar o nome e o D1. Não realizar deploy do `wrangler.jsonc` principal.
7. Verificar `https://clash-of-izzy-beta.jorgepereiragha.workers.dev/api/health`. Exigir `200`, `status=ready`, migrations completas e tabelas `beta_invites`, `beta_access_sessions`, `beta_redeem_attempts`. Sem convite, `/kingdom.html` precisa redirecionar para `/beta-access.html` e `/api/game/state` precisa responder `403 BETA_INVITE_REQUIRED`.
8. Resgatar um convite; conferir cookie `__Host-izzy_beta`, `Secure`, `HttpOnly`, `SameSite=Strict` e acesso ao reino. Verificar que o segundo resgate do mesmo convite de uso único falha. Confirmar contas e dados separados da produção.
9. Manter `BETA_LIVE_PAYMENTS_APPROVED=false`: `GET /api/store/payment-methods` deve retornar dois valores `false`; `POST /api/store/checkout`, `POST /api/store/purchase-request`, `POST /api/support/checkout`, `POST /api/webhook/mp` e aprovação manual devem retornar `503 BETA_PAYMENTS_DISABLED` ao usuário autenticado no beta.
10. Configurar **keystore e certificado separados** para Android beta, colocar os secrets `ANDROID_BETA_KEYSTORE_BASE64`, `ANDROID_BETA_STORE_PASSWORD`, `ANDROID_BETA_KEY_ALIAS`, `ANDROID_BETA_KEY_PASSWORD` no ambiente protegido `beta-signing`; fixar o SHA-256 do certificado em `ANDROID_BETA_CERT_SHA256`. Executar o workflow manual `android-beta-apk.yml` na branch `beta` **somente após** homologação do Worker. O arquivo resultante fica como artefato privado da execução (não como release oficial).
11. Testar em aparelhos reais: login, sessões, reconexão, reino e mundo, desempenho, convites, trocas de rede, 4X com gates, pagamentos desabilitados, instalação simultânea com o APK oficial. Não anunciar distribuição antes dos testes.

## Padrão de segurança e rollback

- Beta e produção têm nomes de Worker distintos, bindings D1 distintos, namespaces de Durable Objects distintos, `SESSION_SECRET` distintos, chaves de assinatura Android distintas e IDs Android distintos. **Não copiar contas, sessões, inventário, gemas nem pedidos da produção.**
- Pagamentos reais ficam desligados em beta mesmo se um token de provedor for acidentalmente configurado. O código NÃO habilita cobrança por meio de uma flag isolada: a habilitação futura exige mudanças revisadas, homologação do provedor, webhook, origem, domínio e reconciliação.
- O bloqueio de pagamento cobre as rotas de checkout, Pix/pedidos e webhook já existentes, além das futuras rotas de escrita sob `/api/store/`. Se o projeto criar novas rotas comerciais fora desse namespace, a auditoria deverá atualizar o bloqueio antes do merge.
- Falha de D1 resulta em negação de acesso, não em passagem livre. Para revogar um convite, marcar `disabled=1`: o gate consulta `beta_invites` junto à sessão e **nega imediatamente o acesso das sessões emitidas por esse convite**. Para uma revogação de sessão individual, atualizar `revoked_at=unixepoch()` em `beta_access_sessions` no banco beta. Gerenciar expiração/limpeza de tabelas manualmente; não há cron beta nesta etapa.
- Para rollback: desligar acesso no beta (`INVITE_ONLY=false` faz o Worker falhar fechado) ou despublicar **somente** o Worker beta. Não executar comandos no D1 da produção.
- A versão Android beta seleciona a URL em compilação via `BuildConfig.BETA`; não aceita URL informada pelo usuário nem redirecionamento para domínio arbitrário. A flag é embutida no APK e o certificado beta não deve ser o mesmo da release oficial.


## Consolidação de componentes (revisão de 23/11/2026)

- **Usar:** `beta-access.js` como única autorização de entrada do beta; `beta-access.html` como tela de convite; `beta/schema.sql` como migração exclusiva do novo D1; `wrangler.beta.jsonc` como única configuração de deploy do Worker beta; `assembleBeta` como variante Android própria.
- **Desativar no ambiente beta:** `/api/beta/signup` (cadastro genérico antigo) retorna 404; `/` e `/portal.html` redirecionam para convite ou reino, conforme sessão. O catálogo/portal promocional original continua no repositório e na produção para não perder o funil de marketing existente.
- **Não reutilizar:** D1 Preview, D1 produção, tokens de sessão, credenciais de pagamentos, keystore Android oficial ou URL de produção dentro do APK beta.
- **Não apagar:** código de reino, combate, aliança, visual 3D, migrações comuns, módulos de pagamento mantidos para a versão oficial, testes da versão oficial, workflow do portal oficial e scripts de recuperação do D1 de produção. A remoção desses arquivos quebraria o jogo que continua operando fora do beta.

### Sessão e cache

O beta não instala o Service Worker offline da produção. A rota `/sw.js` devolve um worker mínimo **sem interceptação de rede e sem cache de gameplay**, limpando caches antigos com o prefixo `clash-of-izzy-`. Os arquivos estáticos servidos pelo Worker beta usam `Cache-Control: private, no-store`, com `X-Frame-Options: DENY` e `Referrer-Policy: no-referrer`. A sessão pode ser consultada via `GET /api/beta/access/status` e revogada via `POST /api/beta/access/logout` (mesma origem); revoga o token no D1 e limpa o cookie. Um convite de uso único **não volta a ficar disponível** quando o usuário faz logout.

### Pagamentos

Nesta versão, `BETA_LIVE_PAYMENTS_APPROVED` permanece com valor `false`, mas é apenas reserva para uma futura homologação. **Trocar essa variável para `true` não libera pagamentos**: o bloqueio do backend continua ativo. A ativação comercial futura requer alterações explícitas e revisadas no código, integração de webhooks sem depender de cookie de usuário, credenciais distintas e testes de reconciliação. Evita que um erro de configuração aceite cobranças reais.

### Limitações que continuam

O gate de convite é uma autorização por sessão de navegador, não substitui autenticação do jogador e ainda não vincula de forma irrevogável o convite a uma conta identificada. Não prometer limite de contas por pessoa. A validação das credenciais Google e do certificado da variante Android beta deve ser feita antes do lançamento, com client ID apropriado à nova origem/pacote. Limites de carga e testes em aparelhos físicos também estão pendentes.

## Pendências para lançamento comercial

CI verde em SHA exato, criação e auditoria do terceiro D1, deploy beta, verificação de rotas reais, homologação de conta Google para a nova origem, proteção de uso por conta/dispositivo (se exigido), assinatura beta, testes em aparelhos e revisão jurídica/comercial. Nenhum desses marcos pode ser presumido por existir código na branch.

## Reaproveitamento funcional 4X no beta isolado (23/11/2026)

Esta melhoria é proposta **somente para a branch `beta`**, não para a produção. A configuração `wrangler.beta.jsonc` passa a definir `GAME_4X_SYSTEMS_ENABLED=true`. Isso reaproveita a implementação real já existente do jogo: `kingdom.html`, `scripts/kingdom-3d.js`, `scripts/kingdom-4x-systems.js`, `intermediate-production.js`, `city-defense-rules.js`, `player-progression-4x.js` e `hero-assignments-4x.js`. Mantém reinos, heróis, dragões, alianças, PvP, mundo, filas, recursos e apresentação visual compartilhados. **Não importa banco de produção nem inventário entre ambientes.**

O backend passa a exigir adicionalmente no **health do beta com 4X habilitado** as tabelas da migração `0041`: `intermediate_resources`, `city_defenses`, `kingdom_progression`, `progression_xp_ledger`. Se não existirem, `/api/health` responde `503 not_ready`, em vez de sinalizar prontidão indevida. As migrações gerais devem ser aplicadas **exclusivamente no novo D1 beta** antes de liberar convites. Essa flag não faz deploy nem cria D1.

O bloqueio de cobrança permanece explícito e independente da flag 4X. `LEVEL_PACKS_ENABLED`, `LEVEL_PACKS_PUBLIC_ENABLED` e demais flags comerciais continuam desativadas; a evolução 4X normal usa recursos do jogo, nunca cria checkout real. Se uma atualização futura alterar rotas comerciais, revisar `betaPaymentDisabled()` antes do merge.

A CI `beta-isolation-ci.yml` agora acompanha mudanças no Worker, assetsignore, migrações e módulos de gameplay compartilhados, além de executar os testes legados de economia/defesas/progressão 4X. Não faz deploy e não assina APK. A alteração deve chegar à `beta` via PR revisada e CI verde; `main` continua preservada.

### Critérios de aceite antes de disponibilizar aos convidados

1. D1 novo com UUID distinto de produção e Preview, migrações completas, schema beta aplicado e secrets próprios; no momento deste commit o UUID continua placeholder.
2. `/api/health` responde `200 ready` apenas com a base comum, as três tabelas de convite e as quatro tabelas 4X presentes.
3. Usuário sem convite não acessa API de jogo, WebSocket nem HTML/GLB. Convite desabilitado invalida imediatamente as sessões associadas, sem apagar jogadores.
4. Testador autenticado consegue criar/retomar reino, abrir cena 3D, atualizar filas, indústrias, defesas e progressão, com os dados persistidos no novo D1.
5. Métodos de pagamento permanecem `false`, checkout e webhooks respondem `503 BETA_PAYMENTS_DISABLED`, mesmo com flags ou secrets acidentais.
6. Testar reconexão, logout, celulares Android, desempenho e invasão de rotas antes de ativar qualquer link público ou APK beta.

### Sobre limpeza do sistema legado

**Nenhuma remoção destrutiva foi feita.** `/api/beta/signup` existe no Worker comum para a versão oficial e permanece inacessível no beta pelo gate. `portal.html` e `public-portal/` continuam para o marketing da versão oficial; não são a entrada do beta. Não excluir `assets/3d/`, `scripts/kingdom-3d.js`, `migrations/`, `sw.js` nem pagamentos compartilhados nesta fase. Uma otimização futura pode reduzir especificamente o bundle de assets do Worker beta sem modificar o portal oficial, após auditoria de referências e testes HTTP reais.

## Preflight obrigatório antes de qualquer operação remota

Execute na branch `beta` o verificador **somente leitura**, que não usa segredos e não acessa Cloudflare:

```bash
node beta/check-isolation.mjs
```

Enquanto o UUID for `REPLACE_WITH_NEW_BETA_D1_UUID`, ele deve informar **BETA ESQUELETO OK**; isso **não é autorização de deploy**. Depois de executar a auditoria do workflow `provision-beta-d1.yml` na `main`, criar o D1 **somente mediante confirmação protegida**, confrontar o novo UUID com produção e Preview e atualizar `wrangler.beta.jsonc` em PR para `beta`, execute:

```bash
node beta/check-isolation.mjs --require-provisioned
```

Esse segundo comando **falha** se o UUID ainda estiver como placeholder, for malformado ou coincidir com produção/Preview. Também rejeita qualquer mudança que desligue o convite, torne o beta um Worker da produção, desative `run_worker_first`, configure cron, adicione segredo em `vars` ou ligue flags comerciais. **Preflight não confirma existência do D1 na Cloudflare, migrações aplicadas, credenciais nem disponibilidade do Worker**; verificar essas condições separadamente antes de prosseguir.

Os caminhos de marketing `/public-portal/*`, `/apoie` e `/apoie.html` retornam `404 BETA_MARKETING_DISABLED` no Worker beta, inclusive com convite ativo, para não confundir páginas de arrecadação da versão oficial com testes gratuitos. `portal-worker.js` é módulo de servidor e está excluído dos assets publicados pelo Worker do jogo. Nenhuma página de marketing, recurso 3D ou código do jogo foi apagado; a produção continua com suas próprias rotas.

A CI beta executa o preflight em modo scaffold, testes de regressão de isolamento/4X/Android e a compilação Android **não assinada**. As etapas com Cloudflare e certificados exigem procedimentos explícitos e separados.
