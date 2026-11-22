# Clash of Izzy

**Distribuição Android:** o portal promocional e o Worker principal estão publicados. Em 22/11/2026, o backend de Eldoria recebeu as migrações D1 até 0035 e passou na auditoria remota, no contrato Android e no smoke test de produção. O aplicativo Android utiliza WebView. O **APK oficial assinado ainda não está publicado**; o APK interno de teste não equivale à distribuição comercial.

Veja [guia de distribuição](docs/DISTRIBUICAO_APK_OFICIAL.md), [auditoria da candidata](docs/AUDITORIA_COMPLETA_2026-11-21.md) [monetização segura](docs/MONETIZACAO_SEGURA.md) e [status auditado do lançamento](docs/STATUS_LANCAMENTO_ANDROID.md).

Jogo de estratégia medieval com interface Web 3D, API em Cloudflare Workers e persistência em Cloudflare D1.

- 🧭 **Manual mestre v2.0 — integração ordenada:** [docs/MANUAL_V2_INTEGRACAO_ORDENADA.md](docs/MANUAL_V2_INTEGRACAO_ORDENADA.md)

## Produção e release

- **Site de divulgação Android:** [Clash of Izzy](https://clash-of-izzy.jorgepereiragha.workers.dev)
- **Portal isolado:** [Clash of Izzy — instalação](https://clash-of-izzy-portal.jorgepereiragha.workers.dev)
- **APK oficial:** [GitHub Releases](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases) — nenhuma release assinada disponível na última auditoria.
- 📘 **Relatório oficial:** [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md)
- ⚙️ **Deploy Cloudflare atualizado e validado (22/11/2026):** [GitHub Actions — run #45018496723](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45018496723) — migrações remotas 0031–0035, Worker/assets, auditoria de schema Android e smoke test de produção aprovados. Bookmark de recuperação D1 arquivado como artifact da execução.
- ✅ **CI validada (22/11/2026):** [GitHub Actions — run #45018277023](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45018277023)

Histórico: Release Visual Premium e Gravador Cinematográfico publicada em 16/11/2026. O deploy final aprovou 224 testes automatizados, publicação do Worker/assets e smoke test de produção. O cache atual do Service Worker na branch `main` auditada é v26. A validação automática confirma que os módulos do gravador estão publicados; a gravação física pós-deploy no Android continua sendo uma conferência recomendada.

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

O workflow `.github/workflows/deploy-cloudflare.yml` **não publica automaticamente em um push para `main`**. Exige `workflow_dispatch` com `confirm_paid_plan` e `confirm_production` como `true`, branch `main`, auditoria remota prévia e aprovação do ambiente protegido `production`, quando configurada. A liberação excepcional pode ser acionada pelo workflow `.github/workflows/liberar-eldoria-prod-apos-ci.yml` após uma CI aprovada, **somente** para um commit exclusivo daquele workflow marcado `[READY-ELDORIA-RELEASE]`, após conferir o estado remoto D1. A liberação delega todas as escritas ao deploy oficial, com captura e arquivamento de bookmark Time Travel, migrações D1 remotas, publicação do Worker/assets e smoke test somente de leitura. Um push para `main` executa a CI de qualidade, não o deploy de produção. A única exceção controlada é o commit exclusivo de liberação descrito acima, após aprovação da CI e das verificações D1.

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
## Auditoria remota automática, somente leitura

Ao integrar alterações na infraestrutura, o workflow `Cloudflare Remote Audit (read-only)` consulta saúde pública, autenticação, identidade separada dos D1, Time Travel e, quando autorizado, assinatura Workers Paid. Ele não publica nem altera o D1. Um resultado sem permissão de Billing **não confirma** que a assinatura paga está ativa. Consulte também `docs/CLOUDFLARE_VALIDACAO_FINAL.md`.
