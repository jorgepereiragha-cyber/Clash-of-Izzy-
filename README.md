# Clash of Izzy

Jogo de estratégia medieval com interface Web 3D, API em Cloudflare Workers e persistência em Cloudflare D1.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior.

```bash
npm install
npm run db:migrate:local
npm run dev
```

Comandos úteis:

- `npm test`: testes do simulador de combate.
- `npm run check`: valida o bundle do Worker sem publicar.
- `npm run db:migrate:local`: aplica as migrações no D1 local.
- `npm run db:migrate:remote`: aplica as migrações no D1 remoto.

## Deploy automático

O workflow `.github/workflows/deploy-cloudflare.yml` valida o bundle, aplica as migrações e publica o Worker e os arquivos estáticos quando há push na branch `main`.

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

Migrações atuais: `0001` a `0014`. A migração `0010` adiciona limites atômicos de requisições por IP, jogador e conta, armazenando somente identificadores HMAC. A migração `0005` preserva frações da produção passiva e adiciona índices; `0006` protege a resolução única de marchas; `0007` adiciona o token de concorrência das batalhas PvE.

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
- A cena pode carregar modelos glTF/GLB pelo manifesto em `assets/3d/manifest.json`; o manifesto está preparado, mas ainda não contém modelos finais.
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
- O sistema ainda não processa PIX/cartão automaticamente nem confirma pagamento por webhook. O administrador deve conferir o recebimento fora do jogo antes de aprovar.


## Forja, ciência e progressão de heróis
- O catálogo de equipamentos permanece em `worker.js` e usa `kingdom_equipment`/`hero_equipment`; os quatro itens iniciais são semeados, enquanto novas peças exigem forja com ouro e ferro.
- A árvore `gear_forging`, `gear_ward`, `gear_vitality` e `gear_logistics` reutiliza a tabela `research` existente e exige o Centro de Pesquisa Militar. Os bônus são calculados no servidor e aplicados ao herói ativo: ataque, defesa, vida, crítico, marcha e produção.
- Acertos críticos usam semente registrada no relatório de batalha, permitindo auditoria/reprodução do cálculo. A velocidade de marcha usa uma função determinística com limite de bônus.
- `hero_inventory` é a fonte de progressão/estrelas/fragmentos; `heroes` é a identidade relacional usada por equipamentos. `syncHeroSystems` mantém ambos alinhados por `(kingdom_id, hero_key)` e o treinamento atualiza os dois no mesmo lote.


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
- Resultados são deduplicados, priorizam correspondência exata/prefixo e não expõem IDs internos. A tolerância a erros usa candidatos limitados pelo índice trigram FTS5 e verificação Damerau–Levenshtein em memória; termos numéricos, curtos e CJK não recebem correção aproximada. O fallback SQL continua disponível se um índice FTS estiver indisponível.
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
