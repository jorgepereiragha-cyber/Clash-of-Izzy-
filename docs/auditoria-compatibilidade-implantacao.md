# Auditoria de compatibilidade das propostas de finalização

Esta auditoria compara os blocos de código recebidos com a arquitetura que realmente existe na branch `main`. As propostas devem ser adaptadas ao repositório; copiar a estrutura alternativa literalmente quebraria contratos existentes.

## Estrutura autoritativa

- Entrada Cloudflare: `worker.js`; não existe `src/worker.js` como ponto de entrada.
- Configuração: `wrangler.jsonc`, com D1 `DB`, assets estáticos na raiz e cron de um minuto.
- Banco: migrações incrementais em `migrations/0001_...` até `0016_...`. Não substituir o histórico por um `schema.sql` agregado.
- Dependências: Wrangler 4 e scripts de validação em `package.json`.

## Propostas incompatíveis ou já atendidas

| Proposta recebida | Estado verificado no repositório | Decisão |
|---|---|---|
| Recriar `players` com `id TEXT`, username, e-mail e recursos | `players.id` é INTEGER; `players.player_id` é o identificador público único. Recursos, produção e nível pertencem a `kingdoms`. | Não substituir nem alterar a identidade relacional. |
| Criar `player_cosmetics` para o passe | O código não referencia `player_cosmetics`. A fonte cosmética existente é `kingdom_cosmetics`, criada em `0009_runtime_tables.sql`, junto com carteira e coleções. | Não criar uma tabela paralela sem uma feature que a consuma. |
| Criar `chat_messages` e índice composto | O chat de aliança utiliza `alliance_chat`, criado em `0004_alliance_social.sql`. | Não criar segunda tabela. A conversa atual não é E2EE: a coluna `message` é persistida pelo servidor. |
| Adicionar router em `src/worker.js` | O `worker.js` existente já autentica tokens assinados, serve assets e despacha as rotas de jogo/admin. | Não duplicar o router nem trocar JWT por KV session lookup. |
| Exportar `handleCron` em `src/modules/cron.js` | A agenda está no export default `scheduled(controller, env)` do Worker. O Cron atual roda a cada minuto. | Integrar tarefas novas ao scheduler existente. |
| Adicionar `public/js/config.js` com `clash_auth_token` | O cliente usa o token de jogo `coi_game_token` e rotas same-origin; o frontend atual não usa o contrato global `API_BASE_URL/getToken` proposto. | Não introduzir um segundo nome de token nem CORS universal. |
| Declarar seis KV, R2 e duas Queues | Essas bindings não existem na configuração atual e não são necessárias para as features já ligadas a D1. | Só criar recursos quando houver código consumidor e IDs reais. |
| Considerar busca FTS5 como código por adicionar | A busca global existe nas migrações `0012`, `0014`, `0015`, com busca por prefixo, trigramas, descoberta de nicknames, ranking e fallback. | Reutilizar `GET /api/game/search`; não duplicar FTS5. |
| Considerar assets GLB como zero | O manifesto `assets/3d/manifest.json` já lista modelos CC0 Kenney habilitados; o CI executa `npm run assets:validate`. | Manter o manifesto e pipeline atuais; ainda falta ampliar a cobertura artística de todos os edifícios/heróis/tropas e inspecionar em Android real. |
| Considerar passe de batalha e tutorial como implementados | Não há módulo/rota de battle pass ou tutorial na branch `main` consultada. | Não declarar essas features prontas sem implementação e testes próprios. |

## E-mail transacional adicionado nesta revisão

A migração `0017_verified_transactional_email.sql` e `email-system.js` acrescentam o fluxo de endereço verificado, preferências, histórico e fila Resend. A migração `0018_feedback_analytics_beta.sql` acrescenta lista beta consentida, analytics com campos permitidos e formulário de feedback. O Worker autentica as rotas do jogador, executa a fila no Cron existente e enfileira recibo após aprovação Master.

A ativação real depende de configurar `RESEND_API_KEY`, `EMAIL_FROM` com domínio verificado no Resend e `FRONTEND_URL` com a URL pública correta. Digest semanal, retorno de inativos e alertas de combate/evento ainda não foram conectados às rotinas de gameplay e não devem ser anunciados como ativos.

## Limite entre validação e produção

O CI testa migrações locais, assets, suíte Node e bundle. A aprovação do CI/PR não significa que secrets externos foram configurados, que e-mails foram entregues, nem que o Worker/D1 remoto foi publicado e testado. A implantação só deve ser considerada concluída após configuração das secrets, migração remota, deploy e smoke test no endereço público.

## Revisão dos 10 itens da auditoria enviada

A revisão abaixo foi conferida com a implementação e os testes atuais. "Não aplicar" significa que o bloco proposto cria um segundo sistema ou pressupõe tabelas/identidades inexistentes; não significa apagar uma feature funcional.

| Item | Decisão aplicada | Motivo técnico |
|---|---|---|
| 1. Substituir o banco por `schema-completo.sql` | **Não substituir.** Manter migrações incrementais e dados existentes. | `players.id` é INTEGER e `players.player_id` é o ID público. A economia e o progresso vivem em `kingdoms`. O sistema cosmético existente usa `kingdom_cosmetics`, `kingdom_cosmetic_wallet` e `kingdom_collection_claims`. A migração `0017` já cria e semeia `email_templates` com `INSERT OR IGNORE`. As tabelas de push, analytics, beta, feedback e request logs não têm consumidores/rotas atuais; criá-las isoladamente deixaria dados sem fluxo funcional. |
| 2. Criar `src/worker.js` e um router por imports dinâmicos | **Não criar.** Preservar `worker.js` como entrypoint de `wrangler.jsonc`. | O Worker já trata health, assets, sessões, rotas do jogo, painel Master e o método `scheduled`. Não existem os módulos `src/modules/*` propostos. |
| 3. Criar outro `auth.js` | **Não duplicar autenticação.** | O jogo usa identidade pública e token assinado/verificado com `SESSION_SECRET`. O módulo enviado introduziria KV sessions, outro modelo de conta por e-mail/senha e hash SHA-256 com salt fallback, incompatíveis com o fluxo atual. |
| 4–6. Criar analytics, feedback e beta | **Aplicar como funcionalidades integradas na migração 0018.** | Foram criadas apenas `analytics_events`, `feedback` e `beta_signups`, com endpoints no Worker, limites de requisição, consentimento explícito e testes. A página inicial envia inscrições beta; a central do reino registra abertura de sessão e recebe avaliações. Push subscriptions e logs genéricos continuam fora do escopo porque não há consumidores correspondentes. |
| 7. Ativar webhook automático do Mercado Pago | **Não conectar o código enviado. Manter aprovação Master.** | O checkout atual usa um link fixo do Mercado Pago. A tabela `purchase_requests` não possui o `external_reference`/metadata por pagamento assumidos pelo exemplo; não há tabelas `transactions` ou `gem_packages`. Um link compartilhado não associa, por si só, o pagamento a um pedido específico. O `payment_reference` recebido do cliente não é prova de pagamento. Automatizar o crédito sem uma sessão de checkout vinculada e reconciliação idempotente permitiria crédito indevido ou duplicado. |
| 8. Adicionar lock por KV em combate | **Não adicionar.** A proteção atual é mais apropriada. | A migração `0007_battle_token.sql` adiciona token de concorrência por reino. O Worker lê o token e o atualiza com compare-and-set em D1 antes de consumir tropas; o mesmo guard é usado no ataque do evento mundial. O lock KV sugerido não é atômico e não substitui a validação/transação D1. |
| 9. Adicionar `public/js/config.js` | **Não adicionar outro contrato global.** | O cliente usa o fluxo de sessão e as rotas same-origin já existentes. `game-config.js` contém definições do jogo, não credenciais/API. Introduzir `clash_auth_token`, `API_BASE_URL` e helpers paralelos criaria divergência de sessão e CORS desnecessário. |
| 10. Dividir a versão do Service Worker entre config e SW | **Não duplicar configuração.** | `sw.js` já controla o cache pela constante única `CACHE_NAME` (`clash-of-izzy-shell-v14`) e mantém a lista `CORE_ASSETS`. O validador atual do Service Worker passou no CI. A versão deve ser incrementada no próprio SW quando os assets cacheados mudarem. |

### Resultado operacional

- Nenhum arquivo de entrada, identidade de jogador ou migração histórica foi apagado.
- Nenhuma tabela produtiva foi removida, recriada ou renomeada.
- O workflow de produção agora registra um bookmark Cloudflare D1 Time Travel antes das migrações e arquiva o comando de recuperação como artifact do GitHub Actions por 30 dias.
- Nenhuma migração remota, reset D1, alteração de secrets ou deploy foi executado até a revisão desta branch; isso só ocorrerá após o merge aprovado e o workflow de produção iniciar.
- O e-mail transacional da migration `0017` permanece na branch desta PR, sem afirmar que está operacional antes da configuração de Resend.
- O controle de concorrência de combate e a busca global existentes foram reutilizados; não foi criado segundo mecanismo.

A validação GitHub Actions da revisão anterior concluiu com sucesso no commit `cb7fa5f376c6c8b6379fc9a2366a84ea051ed4e4` (run `43783494823`, job `quality`). Isso valida a suíte e o bundle no ambiente de CI; não comprova deploy, webhook, entrega de e-mail ou configuração externa.
