# Clash of Izzy

Jogo de estratégia medieval com interface Web 3D, API em Cloudflare Workers e persistência em Cloudflare D1.

- 🧭 **Manual mestre v2.0 — integração ordenada:** [docs/MANUAL_V2_INTEGRACAO_ORDENADA.md](docs/MANUAL_V2_INTEGRACAO_ORDENADA.md)

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