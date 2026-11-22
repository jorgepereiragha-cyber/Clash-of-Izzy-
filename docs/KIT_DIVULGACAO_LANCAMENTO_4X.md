# Clash of Izzy — Kit de divulgação 4X e plano GO/NO-GO
Data-base: 22/11/2026 · Estado: **materiais prontos para revisão; atualização 4X NÃO anunciada como lançada**

> Segurança operacional: **não publicar um anúncio de lançamento, pacotes com cobrança, bônus prometidos ou APK comercial** antes das evidências em `#234`, revisão das PRs e confirmação do deploy. Este documento não executa deploy nem publica em redes sociais.

## 1. Evidências e estado revisado

- Repositório principal: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-
- Página informada do projeto: https://clash-of-izzy.jorgepereiragha.workers.dev/ (verificar acesso e CTA em dispositivo real antes de divulgar; este documento não atesta uptime).
- CI no commit `0f4388a12283c1c88fada3e14306c4a3e09ab52d`: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/45051493355 — job `verify` concluído com sucesso (Node/D1 local, JS, Service Worker, assets e dry-run Worker; **não é teste real de compra ou Android físico**).
- `#223` aberta (base `main`); `#229`, `#233` e `#236` permanecem **Draft** e encadeadas, não integradas na main.
- `#236` contém Service Worker v53, ornamentos 3D e teste `blueprint-77777-regression.test.js`, mas apenas na branch de revisão.
- Catálogo P1–P8 e migrações 0042/0043 também estão em branch de revisão; **preços propostos P4–P8 não aprovados para comercialização**.
- A última auditoria documentada para D1 produção citou 0036; consultar o D1 ao vivo de novo antes de qualquer migração. Não presumir o estado.
- APK release assinado e Sandbox real do Mercado Pago não foram comprovados por esta CI.
- Checklist mestre: https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/issues/234

## 2. Texto de pré-lançamento — utilizável após conferir o link público

### Discord / comunidade — antecipação

**O Clash of Izzy está evoluindo!**

Estamos preparando uma nova fase do nosso jogo medieval de estratégia: melhorias de castelo, sistemas de produção, defesas e otimizações para a experiência mobile.

As funcionalidades 4X mais recentes estão em **homologação**. Antes de liberá-las, vamos validar o desempenho no Android, a persistência dos reinos e a segurança dos pagamentos.

Acompanhe o projeto e participe da comunidade: https://clash-of-izzy.jorgepereiragha.workers.dev/

*Nota: este é um anúncio de desenvolvimento, não uma confirmação de que a atualização 4X já está em produção.*

### Instagram / TikTok — legenda de antecipação

Seu reino está prestes a evoluir. 🏰

Estamos trabalhando em novos recursos de estratégia, visuais de castelo e melhorias para jogar pelo celular. A próxima atualização do **Clash of Izzy** está passando pelos testes finais.

Acompanhe as novidades pelo link da bio.
#ClashOfIzzy #JogoDeEstrategia #JogoMobile #JogoIndie #4X

### Comunicado por e-mail — desenvolvimento

**Assunto: Clash of Izzy — novidades do desenvolvimento**

Olá!

Estamos finalizando os testes de uma atualização voltada à estratégia e à experiência no celular. Entre as melhorias em avaliação estão novos sistemas de produção, organização de defesas e elementos visuais para castelos.

Ainda não anunciamos uma data de liberação comercial. Divulgaremos a disponibilidade quando os testes em ambiente real estiverem concluídos.

Acompanhe: https://clash-of-izzy.jorgepereiragha.workers.dev/

Equipe Clash of Izzy

## 3. Texto de lançamento — usar SOMENTE após GO aprovado

**Pré-condições:** PRs integradas e deploy verificado; funcionalidades 4X ativas no ambiente público; banco migrado com backup/restore comprovados; Android físico validado; textos e imagens correspondentes ao que está disponível; checkout e Sandbox aprovados se anúncios citarem pacotes.

### Discord / comunidade — lançamento

**A atualização 4X do Clash of Izzy está disponível!**

Uma nova etapa da estratégia medieval chegou: desenvolva seu reino, organize suas construções e explore as melhorias de progressão e apresentação visual que agora estão ativas no jogo.

Entre para conhecer a atualização e ajude nossa equipe a identificar oportunidades de melhoria.

Jogar: https://clash-of-izzy.jorgepereiragha.workers.dev/

*Antes de publicar, substituir as descrições genéricas pelas funcionalidades comprovadamente presentes no deploy e registrar o commit de produção.*

### Instagram / TikTok — lançamento

A nova fase do Clash of Izzy chegou! ⚔️🏰

Construa seu reino, evolua seu castelo e conheça as novidades da estratégia 4X.

Jogue pelo link da bio.
#ClashOfIzzy #4XStrategy #MedievalStrategy #MobileGame #IndieGame

### E-mail — lançamento

**Assunto: A nova atualização do Clash of Izzy está disponível**

Olá!

A atualização do Clash of Izzy foi publicada. Entre no jogo para conhecer as mudanças implementadas e continuar sua jornada de estratégia medieval.

Acessar: https://clash-of-izzy.jorgepereiragha.workers.dev/

Estamos acompanhando o desempenho da atualização e recebendo relatos da comunidade.

Equipe Clash of Izzy

**Não prometer** recompensa surpresa, 60 FPS garantidos, carregamento em 3 segundos, funcionalidades específicas de VIP8, 35 dias de proteção do trono ou pacote R$ 3,99 até que esses itens sejam confirmados no ambiente público.

## 4. Sequência técnica obrigatória antes de anunciar lançamento

- [ ] Revisão das PRs `#223 → #229 → #233 → #236` na ordem das dependências; remover Draft apenas após os respectivos critérios; CI no SHA definitivo após rebase/retarget.
- [ ] Conferir schema e `d1_migrations` no D1 produção sem escrita; comparar todas as migrações pendentes, incluindo 0043.
- [ ] Exportação D1 fora do Git; verificar checksum e restaurar cópia **em ambiente isolado**, não na produção.
- [ ] Teste real Mercado Pago Sandbox: status autenticado via API, HMAC do webhook, valor correto, entrega idempotente, replays, concorrência, refund/chargeback e reconciliação.
- [ ] Validar catálogo P1–P8, aprovação comercial dos preços, flags desligadas por padrão e canary/allowlist antes de abrir para todos.
- [ ] APK assinado com certificado comercial persistente e instalação em Android físico; testar touch, rolagem, loja, WebGL fallback/restore, rede offline e retomada, memória, FPS e consumo.
- [ ] Aprovar deploy pelo workflow protegido do repositório; não rodar `wrangler d1 migrations apply --remote` improvisadamente em terminal sem o plano de rollback.
- [ ] Após deploy: smoke test da versão pública, login, recursos, mapa, onboarding, compra sandbox no ambiente correto, persistência e integridade do saldo.
- [ ] Liberar divulgação comercial apenas com evidência, responsável e decisão **GO** registrada em issue.

## 5. Distribuição e acompanhamento

1. Conferir a URL, captura real do jogo e identidade visual no Android antes de preparar o link da bio.
2. **Pré-lançamento:** publicar teaser de desenvolvimento; nunca oferecer compra indisponível.
3. **GO:** publicar comunicado de lançamento em canais conectados, um por vez; revisar links e descrições reais.
4. Monitorar 24h: erros Worker, latência, falhas Android, downloads/instalações verificáveis, tickets, webhooks, ledger de concessões, pagamentos sem entrega e pedidos duplicados.
5. Definir dono da decisão de rollback e manter flags de compra fechadas se houver incongruência de crédito, cobrança ou sessão.
6. Sem autorização de acesso às contas sociais, o repositório somente **armazena rascunhos**: nenhum post, mensagem ou e-mail é enviado por este arquivo.

## 6. Registro de publicação

Preencher apenas após o lançamento:
- Commit `main` publicado:
- GitHub Actions deploy e resultado:
- Migrações efetivas em produção:
- URL e teste de Android físico:
- Checkout Mercado Pago e reconciliação:
- Responsável pela decisão GO:
- Canais publicados, links dos posts e horário:
- Monitoramento 24h:
