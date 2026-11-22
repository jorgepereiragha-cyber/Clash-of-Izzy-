# Clash of Izzy — Relatório de homologação 4X

Data: 2026-11-22. Escopo: PR #229 empilhada sobre PR #223.

## Evidências concluídas

| Verificação | Resultado | Evidência |
|---|---|---|
| Schema D1 Preview remoto | 0036–0041 aplicadas em sequência, novas tabelas presentes | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45031361140 |
| Dados antigos no Preview | Jogadores, contas e pagamentos zero antes da migração | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45031226707 |
| Teste HTTP Worker com D1 Preview e flag 4X | Aprovado, jogador sintético eliminado após teste | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45031813620 |
| Torre e limites | Castelo insuficiente rejeita, torre cria e debita exatamente uma vez | mesmo teste HTTP |
| Colisão 50×50 | Defesa sobreposta rejeitada sem cobrança de recursos | mesmo teste HTTP |
| Produção intermediária | Trigo→farinha→comida confirmado e segundo tick não duplica | mesmo teste HTTP |
| XP P1–P8 | Fila legítima concluída atribui XP uma vez; VIP legado intacto | mesmo teste HTTP |
| Emulador Android | APK debug instalado e aberto em emulador Pixel | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45031469200 |
| Testes HMAC e cobrança simulada | Assinatura, valor divergente e replay aprovados; sem cobrança | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45032017121 |
| Visual mobile 4X contra Worker e D1 Preview | Painel, progresso, estoque, bloqueio de colisão, posição livre e JS sem erros; imagens capturadas | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45032336540 |
| Estado público de pagamentos | Endpoint de produção respondeu `mercadoPago:false`, `nubankPix:false` | mesmo diagnóstico de pagamento |
| CI original da PR #229 | Node, D1 local, Playwright e Worker bundle aprovados | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45030588462 |

### Escopo do teste real de API

O script `scripts/4x-preview-live-smoke.mjs` executa via `wrangler dev --remote` com uma configuração efêmera que vincula exclusivamente o D1 Preview e habilita `GAME_4X_SYSTEMS_ENABLED=true`. Produção e pagamentos reais não são vinculados. O script cria e elimina apenas um usuário sintético; não cria pedidos bancários.

### Princípios de segurança

- A única migração remota realizada foi no **D1 Preview**, após preflight de identidade e dados. Nunca aplicar 0041 diretamente na produção sem backup, revisão do histórico D1 e homologação de release.
- Nenhuma senha, token Mercado Pago, Pix, certificado Android ou assinatura privada foi incluída em código ou artefatos.
- Os testes do webhook usam provedor simulado e segredos fictícios; não comprovam homologação financeira com o Mercado Pago.
- O emulador Android demonstra abertura do APK debug. Não substitui teste em aparelho físico nem constitui release comercial.
- A flag 4X deve permanecer ausente/desligada em produção até migração do banco real, testes de regressão e go/no-go explícito.

## Pendências bloqueantes

1. **Pagamentos:** validar configuração de `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` em ambiente de teste; fazer checkout sandbox, notificação HMAC real, conciliação e somente depois promover configuração comercial. Endpoint de produção informa que Mercado Pago e Pix Nubank estão indisponíveis.
2. **Android comercial:** validar keystore persistente e fingerprint autorizado, compilar assinatura release, instalar no Android físico, inspecionar câmera/zoom/frames 3D, navegador de apoio e link de distribuição. O APK debug não é prova de publicação.
3. **Lançamento:** merge da PR #223, rebase e homologação da #229; snapshot/backup e conferência `d1_migrations` em produção; deploy protegido; ativação da flag 4X apenas com schema 0041 confirmado.
4. **Monitoramento:** verificar erros 4XX/5XX, saldo de recursos, duplicação de XP, desempenho mobile, respostas de webhook e telemetria nas primeiras 24 horas após a ativação.

## Roteiro de inspeção manual no Android

- [ ] Instalar o APK de teste em aparelho físico.
- [ ] Verificar login, cache/PWA e recuperação da sessão após reabrir o aplicativo.
- [ ] Confirmar renderização da cidade 3D e fallback 2D em aparelho intermediário.
- [ ] Confirmar pan/zoom, botões tocáveis, grid e cores da prévia de defesa.
- [ ] Validar na versão Preview habilitada a montagem do moinho/padaria, posicionamento e saldo no D1.
- [ ] Confirmar FPS e ausência de falhas no `chrome://inspect/#devices`.
- [ ] Verificar separação do portal de divulgação e do jogo autenticado.
- [ ] Não usar cartão real antes da homologação sandbox.

## Arquivos de referência

- `migrations/0041_4x_industries_defenses_progression.sql`
- `scripts/4x-preview-live-smoke.mjs`
- `tests/mercadopago-4x-integration.test.js`
- `docs/INTEGRACAO_4X_0041_RELEASE.md`
