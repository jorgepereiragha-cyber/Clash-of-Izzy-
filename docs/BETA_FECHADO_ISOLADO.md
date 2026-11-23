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
- Falha de D1 resulta em negação de acesso, não em passagem livre. Para revogar um convite, marcar `disabled=1`; para revogar sessões já emitidas, atualizar `revoked_at=unixepoch()` em `beta_access_sessions` para os `invite_id` correspondentes. Gerenciar expiração/limpeza de tabelas manualmente; não há cron beta nesta etapa.
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
