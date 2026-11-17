# Clash of Izzy

Jogo de estratégia medieval com interface Web 3D, API em Cloudflare Workers e persistência em Cloudflare D1.

- 🧭 **Manual mestre v2.0 — integração ordenada:** [docs/MANUAL_V2_INTEGRACAO_ORDENADA.md](docs/MANUAL_V2_INTEGRACAO_ORDENADA.md)

## Produção e release

- 🎮 **Jogar:** [Clash of Izzy — Produção](https://clash-of-izzy.jorgepereiragha.workers.dev)
- 📘 **Relatório oficial:** [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md)
- ⚙️ **Deploy final validado:** [GitHub Actions — run #43872671573](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671573)
- ✅ **CI final validada:** [GitHub Actions — run #43872671700](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/43872671700)

Release Visual Premium e Gravador Cinematográfico publicada em 16/11/2026. O deploy final aprovou 224 testes automatizados, publicação do Worker/assets e smoke test de produção. O cache atual do Service Worker na branch `main` auditada é v26. A validação automática confirma que os módulos do gravador estão publicados; a gravação física pós-deploy no Android continua sendo uma conferência recomendada.

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

## Deploy manual protegido

O workflow `.github/workflows/deploy-cloudflare.yml` **não publica automaticamente em um push para `main`**. A publicação só pode ser iniciada manualmente em GitHub Actions (`workflow_dispatch`) e exige marcar `confirm_production` como `true`, além do ambiente protegido `production`. O fluxo executa testes, validação do bundle, migrações D1 locais, captura e arquivamento de um bookmark Time Travel, migrações D1 remotas, publicação do Worker/assets e smoke test de produção somente de leitura. Um push para `main` executa a CI de qualidade, não o deploy de produção.

O artifact `clash-of-izzy-d1-pre-migration-restore-point-*` registra o bookmark e o comando de recuperação. **Restaurar Time Travel sobrescreve o estado atual do banco**; não execute uma restauração sem plano de recuperação e autorização.

Atenção: `npm run db:migrate:remote` aponta para o D1 configurado em `wrangler.jsonc`, que na `main` auditada é o banco de produção. Não execute esse comando como teste.

Configure estes segredos no GitHub:

- `CLOUDFLARE_API_TOKEN`: token de API Cloudflare válido (não use a Global API Key).
- `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare que contém o Worker e o banco D1.

Configure também o segredo `SESSION_SECRET` diretamente no Worker Cloudflare (por exemplo, com `npx wrangler secret put SESSION_SECRET`). Use um valor aleatório forte e não o coloque no GitHub, no código ou no `wrangler.jsonc`; sem ele, a criação de reinos retorna erro 503.

Para acessar `admin.html`, configure também `ADMIN_EMAIL` e `ADMIN_PASSWORD` como secrets do Worker Cloudflare. Use uma senha exclusiva e forte. O endpoint administrativo `/api/admin/health` exige uma sessão Master válida; sem autenticação deve responder HTTP 401. Para diagnóstico público de disponibilidade, use `/api/health`, que não revela valores de segredos.

Permissões mínimas do token para este workflow:

- D1: Edit, para executar migrações remotas.
- Workers: Editor (ou Workers Scripts Edit no modelo legado), para publicar o Worker.
- Account Settings: Read, se solicitado pelo Wrangler para identificar a conta.