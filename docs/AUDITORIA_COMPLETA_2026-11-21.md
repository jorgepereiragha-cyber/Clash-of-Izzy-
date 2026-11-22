# Clash of Izzy — auditoria de prontidão (21/11/2026, horário de Brasília)

**Escopo:** PR #150 (site promocional, APK e pagamentos), candidata #145 (mundo Eldoria, gráficos e multiplayer), #148 (salas realtime) e #149 (gráficos adaptativos). Pesquisa em documentação oficial da Cloudflare, Android, GitHub e Mercado Pago. Este documento não confirma implantação ou receitas.

## Diagnóstico com evidências

| Item | Evidência no GitHub | Resultado | Criticidade |
|---|---|---|---|
| PR de distribuição | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/150 | Em draft, fora de main/produção | P0 |
| CI da PR #150 antes da correção | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44964623482 | 290 testes passaram; 2 falhas reportadas pela mesma subprova: teste esperava 400 quando Pix desabilitado devolveu 503 | P0, corrigido no teste |
| APK de teste da PR #150 | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44964623467 | Build de teste aprovado, **não** APK estável assinado com chave permanente | P0 |
| Candidata #145 | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/145 | CI, APK debug e emulador aprovados no HEAD informado, sem deploy em produção | P1 |
| Salas distribuídas #148 | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/148 | 8 salas x 200 conexões por planejamento, somente simulação de identidades; 1.000 sockets reais não verificados | P0 para escala |
| Visual adaptativo #149 | https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/149 | Qualidades Automático, Economia, Equilibrado, Máximo e 2D leve; recursos reconciliados na candidata | P1 |
| Infraestrutura/assinatura do plano Cloudflare | Não há prova de billing nesta revisão | Workers Paid e capacidade financeira **não confirmados** | P0 |
| Pagamentos | `mercadopago-orders.js`, `worker.js`, `docs/MONETIZACAO_SEGURA.md` | Webhook, idempotência e fila implementados; falta comprovar credenciais, conta recebedora, pagamentos de teste e reconciliação | P0 |

**Importante:** CI verde, simulações de 1.000 identidades, testes em Chromium e boot do emulador não comprovam 1.000 usuários reais, boa experiência em Android físico ou faturamento.

## Correções realizadas nesta rodada (PR #150)

1. Atualizado teste de integração do Pix para exigir **HTTP 503** quando `NUBANK_PIX_ENABLED` não está ativado. O bloqueio do backend foi preservado: nenhum pedido Pix deve ser inserido quando a função estiver desabilitada.
2. Workflow `Publicar APK Android oficial`: após `apksigner verify`, exige que a impressão digital SHA-256 do certificado esteja fixada na variável de repositório `ANDROID_RELEASE_CERT_SHA256`. Assinatura trocada, variável ausente ou inválida fazem a publicação falhar.
3. Validação adicional de `applicationId=com.clashofizzy.android`, `ANDROID_VERSION_CODE` e `ANDROID_VERSION_NAME` dentro do APK antes de publicar; evita distribuir um pacote inesperado.
4. Testes estáticos para os novos bloqueios de release e documentação de configuração da variável, mais ajuste de README e monetização sobre o papel promocional do site.

O GitHub Actions gerará a versão final apenas após CI aprovada, merge controlado, verificação operacional, keystore/variável configuradas e autorização explícita. Não executar pagamentos, deploy Cloudflare ou migrações D1 remotas como parte desta auditoria.

## Conflitos e riscos de integração

As branches #145 e #150 foram derivadas da `main` e mudam **13 arquivos em comum** (entre eles `worker.js`, `index.html`, `sw.js`, `arena.html`, `mercadopago-orders.js` e testes). Não é seguro mesclar ambas automaticamente sem examinar os conflitos.

1. Criar uma branch candidata baseada no HEAD de #145 e incorporar as mudanças de #150 **com resolução por arquivo**. Preservar a engine, assets locais Three.js, perfis adaptativos, tickets DO e testes da #145.
2. Manter `/index.html` como marketing e o cliente APK abrindo `/kingdom.html`, mas revalidar a autenticação antes de expor o mesmo host ao navegador.
3. Elevar a versão do cache para um número **superior** ao da candidata #145 (atualmente superior a v29 na #150) e alinhar testes. Não rebaixar o shell nem remover recursos 3D da versão candidata.
4. CI completa (Node/D1 local, Chromium, assets, bundle) e Android emulador **após** a integração. Testar também aparelho físico com rede móvel, baixa memória, desligamento de WebView, reconexão e atualização sobre release anterior.

## Riscos que ainda impedem lançamento comercial

- **Acesso exclusivo via APK não implementado.** O app usa WebView remoto; esconder botões no site não bloqueia `/kingdom.html` se a rota HTTP for acessível. Não usar apenas User-Agent, `Referer` ou um cabeçalho fixo como prova de app legítimo. Projetar autorização no servidor com atestação/medidas compatíveis com distribuição por sideload; Play Integrity tem limitações para instalações fora da Play Store.
- **Integridade de app e dependências.** A #150 ainda usa dependência Three.js de CDN externo em `scripts/kingdom-3d.js`. A candidata #145 adiciona bibliotecas locais; é a direção recomendada para evitar que falhas de CDN prejudiquem a experiência. Não publicar uma versão que perca esses assets.
- **1.000 jogadores:** validar 1.000 sessões WebSocket autenticadas reais, conexões simultâneas por sala, reconexão, CPU e memória DO, requisições/linhas D1, p95/p99, erros e custo. A cota teórica da API não é capacidade contratada do jogo.
- **Pagamentos:** conferir assinatura `x-signature` e origem por consulta da order no Mercado Pago, valor/moeda, persistência e entrega exatamente uma vez. Além de sucesso, simular repetição de webhooks, pagamento parcial, chargeback, reembolso e cancelamento sem dupla concessão de itens. Nubank Pix permanece manual e desabilitado por padrão; jamais liberar apenas com imagem de comprovante.
- **Release:** assinatura com certificado permanente, backup seguro, fingerprint pinado, `versionCode` crescente, verificações do APK instalado e do host de download. Confirmação humana de suporte/privacidade/atendimento.
- **Propriedade intelectual:** jogo medieval 4X pode ter mecânicas do gênero, mas não deve copiar marcas, código, personagens, interfaces ou artes protegidas de outro título. Manter identidade própria `Clash of Izzy`.

## Critérios objetivos de aceite

- [ ] Resolver conflitos das branches e executar **CI completa verde** no commit final reconciliado.
- [ ] Confirmar em Android físico: login, reino, mapa, tropas, aliança, eventos, loja, reconnect, FPS/memória, instalação e atualização.
- [ ] Aplicar migrações apenas em D1 Preview isolado, com plano de reversão e verificação do banco alvo.
- [ ] Demonstrar ambiente staging com 1.000 conexões WebSocket autenticadas reais, p95 e custo medidos.
- [ ] Confirmar plano Cloudflare e verificar limites/custos de Worker, Durable Objects e D1 no painel proprietário.
- [ ] Validar conta recebedora do Mercado Pago, webhook assinando corretamente, compra autorizada, entrega única e fluxo de reembolso.
- [ ] Habilitar Nubank apenas após testes bancários verificados e processo operacional documentado.
- [ ] Escolher e validar solução de acesso exclusivo por aplicativo antes de anunciar essa garantia.
- [ ] Configurar secrets Android e variável do certificado; publicar uma única release oficial mediante aprovação expressa.
- [ ] Somente depois, atualizar o portal em produção e divulgar ao público.

## Pesquisa técnica — documentos oficiais

- Android — assinatura e atualizações: https://developer.android.com/studio/publish/app-signing
- Android — apksigner: https://developer.android.com/tools/apksigner
- Android — segurança de WebView: https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges
- Android — limitações e veredictos Play Integrity em instalações sideload: https://developer.android.com/google/play/integrity/verdicts
- GitHub Actions — segurança e boas práticas: https://docs.github.com/en/actions/reference/security/secure-use
- Cloudflare — Durable Objects / WebSocket hibernation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare — limites D1 e concorrência: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare — preços Durable Objects: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Mercado Pago — assinatura e validação de webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/resources/notifications/webhooks

**Conclusão:** já existe uma base técnica utilizável e uma candidata com testes aprovados, mas **não há evidência suficiente para declarar o jogo comercialmente pronto ou apto para 1.000 usuários reais**. Prioridade imediata: consolidar branches, encerrar testes, validar em ambiente seguro e somente então autorizar release/recebimentos.
