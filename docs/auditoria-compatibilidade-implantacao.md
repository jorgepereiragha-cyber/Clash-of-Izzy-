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

A migração `0017_verified_transactional_email.sql` e `email-system.js` acrescentam o fluxo de endereço verificado, preferências, histórico e fila Resend. O Worker autentica as rotas do jogador, executa a fila no Cron existente e enfileira recibo após aprovação Master.

A ativação real depende de configurar `RESEND_API_KEY`, `EMAIL_FROM` com domínio verificado no Resend e `FRONTEND_URL` com a URL pública correta. Digest semanal, retorno de inativos e alertas de combate/evento ainda não foram conectados às rotinas de gameplay e não devem ser anunciados como ativos.

## Limite entre validação e produção

O CI testa migrações locais, assets, suíte Node e bundle. A aprovação do CI/PR não significa que secrets externos foram configurados, que e-mails foram entregues, nem que o Worker/D1 remoto foi publicado e testado. A implantação só deve ser considerada concluída após configuração das secrets, migração remota, deploy e smoke test no endereço público.
