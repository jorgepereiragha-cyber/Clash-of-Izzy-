# Clash of Izzy

Jogo de estratégia medieval com interface Web 3D, API em Cloudflare Workers e persistência em Cloudflare D1.

## Produção e release

- 🎮 **Jogar:** [Clash of Izzy — Produção](https://clash-of-izzy.jorgepereiragha.workers.dev)
- 📘 **Relatório oficial:** [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md)
- ⚙️ **Deploy final validado:** [GitHub Actions — run #43872671573](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671573)
- ✅ **CI final validada:** [GitHub Actions — run #43872671700](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671700)

Release Visual Premium e Gravador Cinematográfico publicada em 16/11/2026. O deploy final aprovou 224 testes automatizados, publicação do Worker/assets e smoke test de produção. O cache atual do Service Worker é v23. A validação automática confirma que os módulos do gravador estão publicados; a gravação física pós-deploy no Android continua sendo uma conferência recomendada.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior.

```bash
npm install
npm run db:migrate:local
npm run dev
```

Comandos úteis:

- `npm test`: testes de regras, contratos e integração Worker+D1 local.
- `node scripts/production-smoke.js`: smoke test de produção (requer `WORKER_BASE_URL`).
- `npm run check`: valida o bundle do Worker sem publicar.
- `npm run assets:validate`: valida o manifesto 3D v2, GLBs locais, referências de textura e orçamento de arquivos.
- `npm run db:migrate:local`: aplica as migrações no D1 local.
- `npm run db:migrate:remote`: aplica as migrações no D1 remoto.

## Deploy automático

O workflow `.github/workflows/deploy-cloudflare.yml` valida o bundle, captura e arquiva o bookmark de recuperação Time Travel do D1 imediatamente antes das migrações remotas, aplica as migrações e publica o Worker e os arquivos estáticos quando há push na branch `main`. Após a publicação, executa um smoke test somente de leitura no endereço público para confirmar D1, schema, sessão, painel Master, catálogo, autenticação, formulário beta, feedback, analytics, páginas principais, Service Worker com cache v23 e os módulos do gravador cinematográfico. O deploy só termina com sucesso quando esses checks passam. O artifact `clash-of-izzy-d1-pre-migration-restore-point-*` registra o bookmark e o comando de recuperação; restaurar Time Travel sobrescreve o estado atual do banco.

Configure estes segredos no GitHub:

- `CLOUDFLARE_API_TOKEN`: token de API Cloudflare válido (não use a Global API Key).
- `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare que contém o Worker e o banco D1.

Configure também o segredo `SESSION_SECRET` diretamente no Worker Cloudflare (por exemplo, com `npx wrangler secret put SESSION_SECRET`). Use um valor aleatório forte e não o coloque no GitHub, no código ou no `wrangler.jsonc`; sem ele, a criação de reinos retorna erro 503.

Para acessar `admin.html`, configure também `ADMIN_EMAIL` e `ADMIN_PASSWORD` como secrets do Worker Cloudflare. Use uma senha exclusiva e forte. O endpoint `/api/admin/health` informa apenas se as variáveis estão configuradas, nunca seus valores.

Permissões mínimas do token para este workflow:

- D1: Edit, para executar migrações remotas.
- Workers: Editor (ou Workers Scripts Edit no modelo legado), para publicar o Worker.
- Account Settings: Read, se solicitado pelo Wrangler para identificar a conta.

O token precisa pertencer à conta correta e estar dentro do escopo do Worker e do banco utilizados em `wrangler.jsonc`.

## Banco de dados

As migrações são versionadas em `migrations/` e executadas em ordem pelo Wrangler. Não edite migrações que já foram aplicadas em produção; crie sempre um novo arquivo numerado.

Migrações atuais: `0001` a `0022`. As migrações `0019` (temporada Valhalla), `0020` (atribuição de convites), `0021` (nós de recursos, rallies e catálogo inicial de tecnologias) e `0022` (mascotes por reino e retenção de replays) são incrementais e não substituem o schema histórico. A migração `0010` adiciona limites atômicos de requisições por IP, jogador e conta, armazenando somente identificadores HMAC. A migração `0005` preserva frações da produção passiva e adiciona índices; `0006` protege a resolução única de marchas; `0007` adiciona o token de concorrência das batalhas PvE.

## Filas estratégicas persistentes

- Construção, treinamento e pesquisa possuem filas independentes por reino e uma ordem ativa por tipo.
- Os recursos e materiais são debitados ao iniciar; edifícios, tropas e níveis de pesquisa só são entregues ao concluir a fila no Worker.
- O cron do Worker processa ordens vencidas; a leitura autenticada do reino também faz a recuperação de filas vencidas para evitar dependência exclusiva de uma visita do jogador.
- A migração `0016_strategy_queues_and_mage.sql` cria as filas e corrige o catálogo SQL de tropas para aceitar `mage`, já existente no catálogo do Worker.

## Segurança e consistência

- A API valida as ações no servidor; o cliente não determina resultados de combate.
- Débitos de tropas, recompensas, upgrades, pesquisas e batalhas usam operações condicionais e lotes D1.
- Requisições JSON da API têm limite de tamanho.
- Limites de frequência são aplicados no servidor com contadores atômicos em D1; IPs e e-mails não são persistidos em texto aberto.
- A API é same-origin e não libera CORS universal; a limpeza de contadores expirados roda no cron.
- Respostas da API não expõem detalhes internos de exceções.
- O token de sessão do jogo é enviado como Bearer token.

## Aplicativo e desempenho

A interface usa Three.js com instanciamento de objetos repetidos, LOD, redução de resolução adaptativa e perfil móvel. O manifesto e o service worker permitem instalar o shell do jogo e mostrar uma página própria quando não há conexão. Batalhas e sincronização do reino continuam exigindo Internet.

## Equipamentos persistentes

Os equipamentos do reino são armazenados em D1. Níveis, custos em ouro e bloqueios são validados pelo Worker; a interface apenas solicita ações e renderiza o estado retornado pelo servidor. A migração correspondente é `0008_kingdom_equipment.sql`.


## Renderização do reino e equipamentos de herói
- A cidade usa um renderizador Three.js isométrico progressivo, com qualidade adaptativa, instanciamento de vegetação, materiais procedurais e fallback 2D.
- A cena carrega modelos CC0 iniciais de Kenney (torre, muralha, trebuchet, árvores e arqueiro) pelo manifesto v2 em `assets/3d/manifest.json`; eles complementam a geometria procedural, mas ainda não representam a arte final original de todos os edifícios, tropas e heróis.
- O inventário de equipamentos continua em `kingdom_equipment`; loadouts de heróis reutilizam a tabela existente `hero_equipment`, com um item por slot e sem criar um segundo sistema de inventário.
- Os bônus de equipamento só entram em combate/produção quando o item está equipado no herói ativo (maior nível). O estado e as operações são validados no Worker.


## Assets 3D da arena
- A arena e a cidade compartilham a versão Three.js 0.187.0.
- A arena usa um carregador GLB com Draco/KTX2 opcional, cache de texturas, animações glTF e descarte de recursos GPU. O carregador utiliza o renderer já existente; não cria uma segunda cena ou renderer.
- Modelos devem ser GLB autocontidos e ficar em `/assets/models/`; texturas avulsas ficam em `/assets/textures/`. O carregador bloqueia URLs externas para evitar downloads arbitrários.
- Ainda não há modelos GLB reais publicados no repositório; a pipeline está pronta e os diretórios aguardam assets aprovados.


## Loja oficial e aprovação Master
- Pedidos de pacotes VIP e skins pagos usam `purchase_requests`, com chave de idempotência, produto/preço capturados do catálogo, método e referência de pagamento.
- O jogador envia um pedido autenticado; o painel Master lista pedidos pendentes e só libera gemas/skin após aprovação manual.
- Novos pedidos usam exclusivamente o link de checkout do Mercado Pago. PIX direto, transferência e pagamento manual foram desativados para novas compras. As opções antigas permanecem apenas no schema para preservar o histórico de pedidos; o administrador deve conferir o recebimento no Mercado Pago antes de aprovar. O link compartilhado não cria cobrança dinâmica por produto e ainda não há confirmação automática por webhook.


## Forja, ciência e progressão de heróis
- O catálogo de equipamentos permanece em `worker.js` e usa `kingdom_equipment`/`hero_equipment`; os quatro itens iniciais são semeados, enquanto novas peças exigem forja com ouro e ferro.
- A árvore `gear_forging`, `gear_ward`, `gear_vitality` e `gear_logistics` reutiliza a tabela `research` existente e exige o Centro de Pesquisa Militar. Os bônus são calculados no servidor e aplicados ao herói ativo: ataque, defesa, vida, crítico, marcha e produção.
- Acertos críticos usam semente registrada no relatório de batalha, permitindo auditoria/reprodução do cálculo. A velocidade de marcha usa uma função determinística com limite de bônus.
- `hero_inventory` é a fonte de progressão/estrelas/fragmentos; `heroes` é a identidade relacional usada por equipamentos. `syncHeroSystems` mantém ambos alinhados por `(kingdom_id, hero_key)` e o treinamento atualiza os dois no mesmo lote.



## Mascotes e replays de batalha (migração 0022)
- A forja continua usando o catálogo e o inventário canônicos `EQUIPMENT_CATALOG`, `kingdom_equipment` e `hero_equipment`; esta expansão não cria inventários paralelos.
- `pet_catalog` define as passivas e `kingdom_pets` armazena posse, nível, experiência e mascote ativo. Cada reino pode ter somente um mascote ativo. O Corvo de Odin é entregue aos reinos existentes e aos novos.
- `GET /api/game/pets/catalog` consulta mascotes e bônus; `POST /api/game/pets/unlock`, `/feed` e `/activate` alteram a progressão com validação no Worker. Alimentação exige `request_key` para que uma repetição não debite ouro nem conceda EXP duas vezes.
- As passivas são aplicadas no servidor: o Corvo acelera marchas individuais e rallies liderados pelo reino, Fenrir amplia o ataque da infantaria e o Dragão Nórdico aumenta a produção de recursos. A progressão escala até o nível 50.
- `battle_reports` continua sendo a fonte dos relatórios. A coluna `replay_json` grava a semente, o exército, modificadores, resultado e quadros do combate. `GET /api/game/battle/replay?battle_id=...` permite acesso apenas ao atacante ou defensor autenticado.
- Replays detalhados expiram após sete dias; a rotina agendada remove os quadros e o payload detalhado, preservando o resumo do relatório. A página `kingdom.html` inclui controles de mascotes e leitor de replay.
- A migração `0022_pets_and_battle_replays.sql` é aditiva. Execute primeiro `npm run db:migrate:local`; a migração remota e o deploy acontecem apenas pelo fluxo aprovado de publicação.


## Busca global do mundo
- A navegação oferece busca local por seções e busca online autenticada por reinos públicos, alianças, territórios e skins.
- A API `/api/game/search` usa FTS5 com remoção de diacríticos e prefixos, limites de tamanho/resultados e rate limit por jogador/rede; mantém fallback SQL `LIKE` caso o índice FTS5 esteja indisponível.
- A migração 0012 cria índice e triggers sincronizados com as tabelas de origem. O endpoint não retorna IDs de jogador nem dados privados.


## Descoberta de jogadores
- Cada jogador pode registrar um nickname público único (3–20 caracteres), normalizado para evitar duplicatas por diferenças de maiúsculas/minúsculas.
- A busca autenticada usa prefixo de nickname, exclui o próprio jogador e retorna somente nickname, reino, nível do castelo e poder; identificadores internos e dados de conta nunca são expostos.
- Limites separados por jogador e rede protegem a rota de descoberta. A migração 0013_player_nicknames.sql adiciona a tabela sem alterar os dados existentes.


## Busca global — melhoria 0014
- A pesquisa unifica jogadores por nickname, reinos, alianças, territórios e skins na mesma API autenticada.
- FTS5 com prefixos continua ativo; índices trigram adicionais cobrem correspondências parciais no meio de nomes e termos, com normalização de acentos.
- Resultados são deduplicados, priorizam correspondência exata/prefixo e não expõem IDs internos. A tolerância a erros usa candidatos limitados pelo índice trigram FTS5 e verificação Damerau–Levenshtein em memória; termos numéricos e curtos não recebem correção aproximada; consultas chinesas, japonesas e coreanas usam trigramas indexados com validação da frase completa, sem correção de caracteres nem segmentação por dicionário. O fallback SQL continua disponível se um índice FTS estiver indisponível.
- A navegação mantém os resultados visíveis ao enviar a busca, informa falhas de sessão/limite/conexão e encaminha categorias para a tela de pesquisa compatível.

## Evento mundial Anjo da Morte
- Evento PvE automático semanal, sexta-feira às 18:00 até segunda-feira às 00:00 no fuso America/Sao_Paulo.
- O servidor mantém o chefe, a vida global, os ataques, as perdas permanentes, a pontuação e o ranking no D1.
- Somente ataques do Anjo da Morte removem tropas permanentemente; batalhas PvE comuns e ataques de território devolvem todas as tropas, mantendo as baixas simuladas apenas no relatório.
- A classificação é encerrada automaticamente no fim do evento e as recompensas são creditadas uma única vez por reino, incluindo gemas, recursos e Essência da Morte.


## Revisão de busca internacional
- Consultas em chinês, japonês e coreano usam contagem por ponto de código Unicode; uma única ideografia/sílaba pode iniciar a busca.
- Consultas CJK curtas ativam fallback SQL limitado por categoria, mesmo quando o índice de prefixos já retorna resultados; consultas maiores usam FTS5 e trigramas.
- A busca portuguesa expande formas comuns de plural e mantém a consulta SQL parametrizada, com fallback por categoria quando um índice FTS falha.
- Reinos vinculados a alianças continuam pesquisáveis e exibem a sigla pública, evitando convites inválidos.


## Busca internacional e resiliente
- Consultas em chinês, japonês e coreano usam contagem por ponto de código Unicode; uma única ideografia ou sílaba pode iniciar a busca.
- Consultas CJK curtas ativam fallback SQL limitado por categoria, mesmo quando o índice de prefixos já retornou resultados; consultas maiores usam FTS5 e trigramas.
- A busca em português expande formas comuns de singular/plural, remove diferenças de acentuação e mantém SQL parametrizado.
- Reinos que já pertencem a alianças continuam pesquisáveis e exibem sua sigla pública; convites inválidos são bloqueados na interface.
- O fallback é acionado por categoria quando um índice FTS falha, evitando que um índice parcialmente indisponível esconda resultados de outras categorias.


## E-mail transacional verificado (migração 0017)
- O projeto não possui `players.email`; os endereços ficam em `player_email_contacts`, ligados ao ID relacional `players.id`.
- O jogador envia o endereço pela rota autenticada `POST /api/game/email/verification`. O sistema envia um link de confirmação com token aleatório, armazena apenas SHA-256 do token e expira o link em 30 minutos.
- `GET /api/email/verify?token=...` confirma o endereço uma única vez. `GET/PUT /api/game/email/preferences` lê/altera preferências e `GET /api/game/email/history` retorna histórico sem expor o endereço completo.
- Preferências para marketing, eventos e alertas começam desativadas. Mensagens opcionais exigem e-mail confirmado e consentimento da respectiva categoria. Mensagens transacionais, como recibo de compra, não usam o opt-in de marketing.
- O Resend é o provedor inicial. O Worker processa até 10 itens da fila por minuto, com chave de idempotência, lease para recuperar execuções interrompidas e até três tentativas separadas por 15 minutos.
- A aprovação de um pedido no painel Master tenta enfileirar o recibo sem interferir na liberação da compra caso o jogador ainda não tenha confirmado e-mail.
- Configure `RESEND_API_KEY` como secret no Worker. Configure `EMAIL_FROM` e `FRONTEND_URL` como variáveis do Worker, usando um domínio remetente previamente verificado no Resend e a URL pública real do jogo. Não invente nem use um remetente de domínio não verificado.
- A fila e o histórico não são marketing automatizado. Digest semanal, retorno de inativos e alertas de combate/evento ainda exigem integração explícita com as respectivas rotinas do jogo; não são considerados ativos nesta entrega.
- A migração é `0017_verified_transactional_email.sql`; nunca edite migrações anteriores já aplicadas. Testes de contrato: `tests/email-system.test.js`.


## Lista beta, analytics e feedback (migração 0018)
- A página inicial oferece inscrição opcional em `POST /api/beta/signup`. O cadastro normaliza o endereço, exige consentimento explícito para convites/atualizações, aplica limite por IP e rejeita endereços duplicados.
- A central do reino envia `POST /api/game/analytics` ao abrir uma sessão e ao enviar feedback. O endpoint exige token de jogo válido, aplica limite por jogador e aceita somente campos de telemetria permitidos; não armazena e-mail, senha, token, IP ou credenciais no payload.
- O formulário de avaliação usa `POST /api/game/feedback`, exige sessão válida, nota de 1 a 5 e comentário de até 2.000 caracteres; o limite é de três envios por jogador por hora.
- A migração `0018_feedback_analytics_beta.sql` cria somente as três tabelas consumidas por essas rotas, com índices e chaves estrangeiras para a identidade interna `players.id`. A lista de beta guarda o consentimento e sua versão.
- O endpoint `/api/admin/health` informa apenas valores booleanos para a prontidão do provedor de e-mail (`RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`). O smoke test registra esse estado, mas não bloqueia a publicação do jogo quando o provedor opcional ainda não está configurado.
- Execute `npm run db:migrate:local` para validar/aplicar migrações no D1 local. A migração remota só ocorre no fluxo de implantação aprovado; não foi executada nesta revisão.
