# Clash of Izzy

Jogo de estratégia medieval com interface Web 3D, API em Cloudflare Workers e persistência em Cloudflare D1.

## Interface do jogo

- `/command-center.html`: centro de comando mobile-first para construções, tropas, ciência, mapa, heróis, dragões e alianças.
- `/arena.html`: arena de batalha 3D.
- `/admin.html`: painel administrativo com busca de jogadores por nick/reino/ID, ficha completa, gestão de recursos, gemas, skins, pacotes VIP e auditoria.
- Jogadores definem um nick único no Centro de Comando; a busca administrativa consulta nick, nome do reino ou ID.
- A entrada principal (`/`) direciona o jogador ao centro de comando e mantém acesso direto à arena.
- O centro de comando reutiliza a sessão `coi_game_token` e os endpoints existentes, sem criar autenticação ou banco duplicado.

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

Configure também `ADMIN_EMAIL` e `ADMIN_PASSWORD` como segredos do Worker para liberar o painel em `/admin.html`. O painel usa token administrativo temporário e não armazena a senha. Configure também o segredo `SESSION_SECRET` diretamente no Worker Cloudflare (por exemplo, com `npx wrangler secret put SESSION_SECRET`). Use um valor aleatório forte e não o coloque no GitHub, no código ou no `wrangler.jsonc`; sem ele, a criação de reinos retorna erro 503.

Permissões mínimas do token para este workflow:

- D1: Edit, para executar migrações remotas.
- Workers: Editor (ou Workers Scripts Edit no modelo legado), para publicar o Worker.
- Account Settings: Read, se solicitado pelo Wrangler para identificar a conta.

O token precisa pertencer à conta correta e estar dentro do escopo do Worker e do banco utilizados em `wrangler.jsonc`.

## Acesso público, instalação e disponibilidade\n\nO projeto inclui PWA instalável, entrada direta no centro de comando, shell offline, endpoint público de prontidão (`/api/health`) e monitor de uptime a cada 15 minutos. Para configurar o domínio, segredos, variável `GAME_PUBLIC_URL`, instalação no Android e alertas, siga [`docs/PUBLICACAO_E_PWA.md`](docs/PUBLICACAO_E_PWA.md). O link para compartilhar será `https://SEU-DOMINIO/command-center.html` após a publicação e validação do endereço real.\n\n## Banco de dados

As migrações são versionadas em `migrations/` e executadas em ordem pelo Wrangler. Não edite migrações que já foram aplicadas em produção; crie sempre um novo arquivo numerado.

Migrações versionadas até `0010`. A `0009` persiste filas de construção, treino e pesquisa; a `0010` registra capítulos e descobertas narrativas por reino, com chave única e validação no Worker. A `0005` preserva frações da produção passiva; `0006` protege a resolução de marchas; `0007` adiciona token de concorrência das batalhas PvE; `0008` registra resgates idempotentes de missões diárias.

## Eventos e LiveOps

A central de eventos já inclui missões diárias reais no servidor: treinar tropas, melhorar edifícios, concluir pesquisas e participar de batalhas PvE. O progresso é calculado a partir dos registros existentes em `kingdom_events` e `battle_reports`; o cliente não informa pontuação. A migração `0008` garante um único resgate por reino, missão e dia UTC, registra o crédito confirmado e adiciona índices compostos para o progresso. Cada recompensa também é registrada no `resource_ledger`. O calendário sazonal, chefes globais, torneios de aliança e eventos entre reinos permanecem identificados como em desenvolvimento e não concedem recompensas ainda.

O catálogo completo de eventos, cadência, critérios de justiça, métricas e roadmap está em [`docs/LIVEOPS_EVENT_DESIGN.md`](docs/LIVEOPS_EVENT_DESIGN.md).

## Segurança e consistência

- A API valida as ações no servidor; o cliente não determina resultados de combate.
- Débitos de tropas, recompensas, upgrades, pesquisas e batalhas usam operações condicionais e lotes D1.
- Requisições JSON da API têm limite de tamanho.
- Respostas da API não expõem detalhes internos de exceções.
- O token de sessão do jogo é enviado como Bearer token.

## Aplicativo e desempenho

A interface usa Three.js com instanciamento de objetos repetidos, LOD, redução de resolução adaptativa e perfil móvel. O manifesto e o service worker permitem instalar o shell do jogo e mostrar uma página própria quando não há conexão. Batalhas e sincronização do reino continuam exigindo Internet.

- [Arquivo Velado — lore e pistas secretas](docs/ARQUIVO_VELADO.md)
- [Árvore tecnológica das sete camadas](docs/ARVORE_TECNOLOGICA_CAMADAS.md)
- [Codex das Origens, Feras e Véus — Cabala, Caim e Abel, bestiário e motivação](docs/CODEX_ORIGENS_FERAS_E_VEUS.md)
- [Exploração 3D e pistas do mundo — arquitetura, segurança e desempenho](docs/EXPLORACAO_3D_PISTAS.md)

- [Jornada inicial, retenção e abertura de reinos](docs/RETENCAO_E_ABERTURA_DE_REINOS.md)
- [Painel administrativo e busca de jogadores](docs/PAINEL_ADMINISTRATIVO.md)
