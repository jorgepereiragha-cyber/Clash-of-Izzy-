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

Migrações atuais: `0001` a `0009`. A migração `0005` preserva frações da produção passiva e adiciona índices; `0006` protege a resolução única de marchas; `0007` adiciona o token de concorrência das batalhas PvE.

## Segurança e consistência

- A API valida as ações no servidor; o cliente não determina resultados de combate.
- Débitos de tropas, recompensas, upgrades, pesquisas e batalhas usam operações condicionais e lotes D1.
- Requisições JSON da API têm limite de tamanho.
- Respostas da API não expõem detalhes internos de exceções.
- O token de sessão do jogo é enviado como Bearer token.

## Aplicativo e desempenho

A interface usa Three.js com instanciamento de objetos repetidos, LOD, redução de resolução adaptativa e perfil móvel. O manifesto e o service worker permitem instalar o shell do jogo e mostrar uma página própria quando não há conexão. Batalhas e sincronização do reino continuam exigindo Internet.

## Equipamentos persistentes

Os equipamentos do reino são armazenados em D1. Níveis, custos em ouro e bloqueios são validados pelo Worker; a interface apenas solicita ações e renderiza o estado retornado pelo servidor. A migração correspondente é `0008_kingdom_equipment.sql`.
