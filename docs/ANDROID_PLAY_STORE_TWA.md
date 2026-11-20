# Clash of Izzy — preparação Android e Google Play Store

**Revisão:** 19 de novembro de 2026  
**Status:** preparação técnica e documental. O jogo ainda não foi publicado na Play Store e não existe AAB assinado neste repositório.

## 1. Arquitetura escolhida

A edição Android será distribuída como **Trusted Web Activity (TWA)**, gerada com Bubblewrap, sobre a PWA atual. A TWA abre o domínio verificado em tela cheia; o reino compartilhado Eldoria, a autenticação, a economia e a persistência continuam usando o Worker + D1 existentes.

```text
Google Play (Android App Bundle)
        |
        v
TWA / Chrome verificado (Bubblewrap)
        |
        v
PWA Clash of Izzy (/kingdom.html)
        |
        v
Cloudflare Worker + D1 (Eldoria compartilhado)
```

Não criar segundo servidor, banco, login ou sistema de economia. A camada Android é a embalagem de distribuição, não uma nova implementação do jogo.

Referências:
- [Trusted Web Activity — início rápido](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)

## 2. Estado técnico comprovado no repositório

- A PWA possui `manifest.json`, modo `standalone`, ícones e entrada em `/kingdom.html`.
- O Service Worker atual é `clash-of-izzy-shell-v40`; ele mantém o shell, os módulos Three.js same-origin e os retratos SVG de heróis em cache e exclui as rotas `/api/*` do cache.
- Three.js está fixado em `0.187.0`; os loaders/decodificadores usados pelo jogo são empacotados localmente.
- A cidade 3D possui fallback visual quando WebGL falha ou perde o contexto.
- O shell offline permite abrir recursos previamente armazenados, mas **não** torna offline login, economia, marchas, batalhas, compras ou sincronização D1.
- A PR #128 acrescenta ajustes responsivos, alvos de toque de 48 CSS px, campos de 16 px, áreas seguras, redução de animação, suspensão de tarefas em segundo plano, retomada de sincronização e gestos de pinça no mapa.
- Os testes Playwright executam em Chromium com viewports móveis. Isso não substitui teste em Android físico.
- Ainda não existe projeto Android TWA/Gradle, Application ID confirmado, assinatura, Digital Asset Links verificado ou AAB assinado.

## 3. Estado das branches e dependências

- **PR #120** é a base de lançamento Eldoria, está aberta e ainda não foi mesclada. Sua branch `release/one-shared-realm-early-access` tem 207 commits à frente e 3 atrás da `main` consultada nesta auditoria; o GitHub informa que a PR está mergeável, mas isso não substitui as validações externas pendentes descritas nela.
- **PR #128** é esta frente Android/qualidade visual, permanece Draft e tem como base a branch da PR #120. O commit auditado antes desta atualização documental era `c6b1232ba7c79e82c41fefa275572bf7bed1279b`.
- **PR #129** também usa a branch de lançamento como base e permanece Draft; a loja adicional não é requisito para criar o pacote TWA inicial.

Não fazer merge em cadeia apenas porque uma PR aparece como mergeável. A base de lançamento precisa concluir sua validação remota de staging e sua inspeção Android antes da liberação.

## 4. Evidência automatizada da PR #128

Execução GitHub Actions [#44393581758](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/runs/44393581758), run #1133, no commit `c6b1232`:

| Verificação | Resultado |
|---|---:|
| Testes Node.js | 319 aprovados |
| Falhas Node.js | 0 |
| Playwright | 8 aprovados |
| Migrações D1 locais | Aprovadas |
| Perfil local de Preview D1 | Aprovado |
| Manifesto/assets 3D | Aprovados |
| Service Worker | Aprovado |
| Wrangler deploy dry-run | 366,66 KiB; 79,67 KiB gzip |

**Interpretação correta da CI:**

- As migrações foram aplicadas somente ao D1 local criado pelo Wrangler durante a CI. Os logs indicam explicitamente execução local; não são prova de migração remota.
- O diagnóstico GET de produção recebeu `Sessão do jogador inválida.`; isso não valida uma sessão real de jogador nem substitui um teste autenticado em staging.
- O smoke test informativo de produção terminou com `A loja não usa o fluxo manual por WhatsApp.`. Essa etapa possui `continue-on-error: true`; portanto, o job geral ficou verde apesar dessa falha informativa.
- A falha confirma uma diferença entre o fluxo esperado pela branch de lançamento e a loja atualmente publicada. Não afirmar que a loja de produção já foi convertida.
- Esta execução corresponde ao commit anterior à atualização deste documento. A nova alteração documental deve gerar uma nova execução de CI; não herda automaticamente o resultado #1133.

## 5. D1 e isolamento do Preview

IDs configurados no repositório:

| Recurso | Binding | Banco | UUID |
|---|---|---|---|
| Produção | `DB` | `clash-of-izzy-db` | `7e63af59-d9ff-4159-a9cf-b02e35b92605` |
| Preview | `DB` | `izzy-preview-17112026` | `6674c0ac-3636-4e57-bff8-23cf60ab9637` |
| Migrações de Preview | `PREVIEW_DB` | `izzy-preview-17112026` | `6674c0ac-3636-4e57-bff8-23cf60ab9637` |

A configuração do Worker Preview está no bloco `previews` de `wrangler.jsonc`. O arquivo `wrangler.preview-migrations.jsonc` aponta para o mesmo UUID usando o binding `PREVIEW_DB`.

Segundo a documentação atual da Cloudflare, Worker Previews não herdam a configuração de produção. Bindings de recursos devem ser declarados no bloco `previews`; dois Previews ligados ao mesmo `database_id` compartilham as mesmas linhas. Secrets são administrados separadamente pela Previews Base configuration ou no Preview individual, e não devem ser inseridos no Wrangler config ou no Git.

Procedimento necessário antes de qualquer teste remoto:

1. Confirmar na conta Cloudflare que o D1 Preview com UUID `6674c0ac-3636-4e57-bff8-23cf60ab9637` existe e é descartável.
2. Confirmar que ele é diferente do UUID de produção.
3. Conferir as migrações remotas pendentes usando `wrangler.preview-migrations.jsonc`.
4. Configurar secrets exclusivos de QA no Previews Base ou no Preview específico, quando necessários: `SESSION_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Não reutilizar secrets de produção.
5. Aplicar migrações somente depois de confirmar identidade, isolamento e backup do banco de staging.
6. Validar login, estado do reino, filas, alianças, loja e equipagem usando contas descartáveis.

A CI atual apenas valida o perfil de Preview localmente; a existência e o estado remoto desse D1 continuam **não comprovados**.

Fontes Cloudflare:
- [Worker Previews — Configuration](https://developers.cloudflare.com/workers/previews/configuration/)
- [Worker Previews — Resources and isolation](https://developers.cloudflare.com/workers/previews/resources/)

## 6. Requisitos atuais da Google Play

1. Conta Google Play Console do proprietário, verificação de identidade e dados de desenvolvedor.
2. Domínio final controlado pelo projeto.
3. Application ID exclusivo no formato reverso de domínio. `com.clashofizzy.game` é apenas uma sugestão; não está reservado nem confirmado.
4. Novos apps e atualizações enviados desde 31/08/2026 devem direcionar Android 16, **API 36 ou superior**.
5. Projeto TWA gerado com Bubblewrap, configurado com domínio, manifesto, nome, ícones, versão e target SDK reais.
6. Certificado/chave de assinatura e Play App Signing; registrar o fingerprint SHA-256 do certificado efetivamente usado.
7. Digital Asset Links em `/.well-known/assetlinks.json`, contendo o Application ID e o fingerprint reais.
8. AAB assinado e testado em aparelho físico.
9. Ficha da loja com descrição, categoria Estratégia, ícone, imagem de destaque e capturas da build real.
10. Política de privacidade pública, Data safety, classificação indicativa, suporte e instruções para acesso de revisão.

Fontes oficiais:
- [Requisitos de nível da API do Google Play](https://support.google.com/googleplay/android-developer/answer/11926878?hl=pt-br)
- [Imagens e capturas da ficha](https://support.google.com/googleplay/android-developer/answer/9866151?hl=pt-br)

### Teste fechado para determinadas contas pessoais

Se a conta de desenvolvedor for pessoal e tiver sido criada depois de 13/11/2023, o Google exige um teste fechado com pelo menos **12 testadores inscritos continuamente por 14 dias** antes do pedido de acesso à produção. Confirmar a condição no Play Console do proprietário.

Fonte: [Requisitos de teste para novas contas pessoais](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt).

## 7. Pagamentos — bloqueio obrigatório antes de vender na Play

Gemas, moedas virtuais, skins, VIP, heróis e outros itens digitais consumidos dentro do jogo são bens digitais. Para a edição distribuída pela Play Store, usar **Google Play Billing** por meio das APIs próprias de TWA e validar a compra no servidor antes de conceder qualquer item no D1.

**Brasil:** o piloto User Choice Billing inclui o país, mas a regra de elegibilidade desse piloto limita os mercados fora do EEE, EUA e Japão a apps móveis/tablets que não sejam jogos. A página atual do novo programa Billing Choice lista Austrália, Japão, Reino Unido, EEE e EUA — não inclui Brasil. Os novos programas Level Up do Play Games / Experiência nos Apps também não listam o Brasil entre os mercados de lançamento. Portanto, para a edição brasileira do Clash of Izzy, não planejar Pix, Mercado Pago ou links externos como alternativa dentro da versão Play sem uma confirmação formal de elegibilidade no Play Console.

**Integração obrigatória na TWA (Bubblewrap):**
- Vincular a conta de desenvolvedor do Google Play à conta de comerciante do Google Payments; configurar os produtos no Play Console; ter pelo menos uma versão em faixa de teste e Digital Asset Links válido.
- Em `twa-manifest.json`, habilitar `features.playBilling.enabled`; depois executar `bubblewrap update` e `bubblewrap build`.
- No site carregado pela TWA, obter o serviço com `window.getDigitalGoodsService("https://play.google.com/billing")`, consultar preços localizados por `getDetails()` e iniciar a compra por `PaymentRequest` com o ID do produto.
- Enviar o `purchaseToken` ao Worker; verificar o estado com a Google Play Developer API e só então conceder a compra. A concessão em D1 precisa ser idempotente, vinculada à conta correta e auditável.
- Só confirmar compra em estado `PURCHASED`, nunca em `PENDING`. Após validar e conceder, consumir produtos consumíveis (como pacotes de gemas) ou reconhecer compras não consumíveis/assinaturas conforme o tipo. A confirmação precisa ocorrer dentro do prazo de três dias para evitar reembolso automático e revogação.
- Sincronizar mudanças, cancelamentos e compras anuladas com notificações do Google Play e consulta server-side. Não confiar apenas no retorno do navegador.
- Se o Play Billing não estiver disponível na edição Play, bloquear a compra e informar indisponibilidade; não fazer fallback automático para Pix, Mercado Pago, WhatsApp ou checkout web. O checkout web fica separado da versão distribuída pela Play.

Fontes oficiais:
- [Play Billing em Trusted Web Activities (Chrome for Developers)](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing?hl=pt-br)
- [Integração do Google Play Billing com o servidor](https://developer.android.com/google/play/billing/backend?hl=pt-br)
- [Política de pagamentos do Google Play](https://support.google.com/googleplay/android-developer/answer/10281818?hl=pt-br)
- [Elegibilidade do User Choice Billing](https://support.google.com/googleplay/android-developer/answer/12570971?hl=pt-br)
- [Programa atual de escolha de faturamento e mercados elegíveis](https://support.google.com/googleplay/android-developer/answer/17161464?hl=pt-br)

## 8. Limpeza de código já realizada na PR #128

Foram removidos somente arquivos identificados como protótipo legado ou sem consumidor no runtime desta edição:

- `game-config.js`: configuração de um protótipo distinto, com economia e entidades que não correspondem ao Worker/D1 atual.
- `packages.js`: catálogo estático antigo com preços/conteúdo desatualizados e abertura direta de WhatsApp; não era carregado pelas páginas atuais.
- `scripts/post-processing.js`: pipeline opcional sem consumidor ativo na renderização atual. Bloom/FXAA/Nordic Grade não devem ser anunciados como efeitos ativos.
- `icons/premium-icons.svg`: sprite SVG de símbolos de recursos sem consumidor encontrado nas páginas e módulos de interface revisados; a referência operacional encontrada era apenas o pré-cache. O arquivo foi removido e a entrada saiu do shell, agora `clash-of-izzy-shell-v40`.
- `assets/art/heroes/portraits.svg`: retratos de heróis adicionados à experiência de apresentação; o sprite é utilizado pelos cartões e foi incorporado ao precache v40. O arquivo é mantido porque tem consumidor real.
- Módulos exclusivos do Worker (`angel-death-event.js`, `api-rate-limit.js`, `battle-replay.js`, `email-system.js`, `kingdom-queue-rules.js`, `mercadopago-orders.js`, `pets.js`, `player-accounts.js`, `rally.js`, `search-ranking.js`, `shared-world-coordinates.js`, `hero-catalog.js` e módulos server-side de Valhalla) continuam no Git e no bundle do Worker, mas foram excluídos dos assets estáticos pelo `.assetsignore`. Isso reduz os arquivos publicados e evita expor endpoints de arquivo desnecessários; não remove módulos necessários do backend.
- `splash-screen.html`: arquivo sem rota, link ou consumidor; não era o ponto de entrada da PWA. O splash de instalação da PWA e o splash da TWA devem ser tratados pelas configurações próprias de cada distribuição.

Foram mantidos:
- `shared-world-coordinates.js`, usado pelo Worker para posicionar castelos no reino compartilhado.
- Os modelos GLB habilitados no manifesto, os recursos de textura usados pelos modelos e os arquivos de licença/proveniência.
- Migrações, módulos do Worker, inventários, dados de jogador, documentação de arquitetura e mecanismos de backup.
- Ferramentas de CI e diagnóstico no Git, excluídas dos assets públicos por `.assetsignore`.

Não fazer exclusões adicionais por nome, tamanho ou aparência. Cada candidato precisa ser rastreado em imports, scripts HTML, Worker, manifestos, Service Worker, testes e referências dinâmicas antes da remoção.

## 9. Recursos do jogo e limites de divulgação

A central de eventos apresenta sete identidades visuais originais, mas seus estados funcionais são diferentes:

- **Anjo da Morte:** combate conectado ao Worker, com perdas, classificação e recompensas processadas pelo servidor.
- **Ascensão de Valhalla:** condicionado à configuração sazonal retornada pelo servidor; permanece desligado até ativação autorizada.
- **Caçada Selvagem:** estrutura de dados existe, mas controlador de combate/premiação continua pendente.
- **Shiva e Khali:** artes originais e prévias; não prometer combate ou recompensas ainda não implementados.
- **Cerco de Eldoria e Torneio dos Campeões:** conceitos ligados às bases de Alianças/Arena; calendário, ranking sazonal e distribuição de prêmios continuam pendentes.

A Forja possui cinco trilhas — arma, elmo, armadura, botas e acessório — com quatro raridades. A fabricação exige peça anterior destravada, pesquisas e recursos; a peça anterior não é consumida. Os cinco equipamentos lendários equipados e destravados no mesmo herói concedem bônus de conjunto. Skins de castelo têm atributos individuais aplicados pelo servidor quando a skin pertence ao jogador e está equipada. Os atributos documentados entram em PvE e Anjo da Morte; não anunciar bônus PvP até integração e teste do sistema PvP.

## 9.1 Heróis, retratos e equilíbrio de atributos

A página de equipamentos agora exibe a coleção com retratos SVG same-origin, raridade, nível, estrelas, fragmentos, atributos e passivos de combate. O Kael inicial possui definição canônica; os heróis de Valhalla usam nome/descrição/estatísticas do catálogo D1 sazonal.

Os valores de atributo da ficha não multiplicam novamente os atributos-base pela raridade. O crescimento por nível e estrelas é aplicado uma única vez. Além disso, cada herói possui passivos server-side progressivos (ataque, defesa, vida e crítico), limitados por perfil e sujeitos aos tetos globais de combate. Os passivos entram nos encontros PvE e no Anjo da Morte; não declarar integração PvP até sua validação.

A tela também expõe as taxas reais do sorteio padrão: 70% comum, 25% raro e 5% lendário; o elenco atual resulta em 17,5% por herói comum, 5% por herói raro e 1,25% por herói lendário. Para o pacote de dez, a chance acumulada de pelo menos um lendário é 40,13%; para um lendário específico, 11,82%. O jogador pode convocar um herói por 100 gemas ou dez por 900; duplicatas viram fragmentos. A ação continua autenticada e o Worker/D1 permanece responsável por debitar gemas, sortear raridade e conceder fragmentos/heróis. Não existe garantia de lendário por quantidade fixa de tentativas.

**Limite funcional confirmado na auditoria:** `skill`, `skill_description` e `skill_power` estão no catálogo e na ficha visual, mas não são consumidos pelo motor de batalha em `game-adapter.js`. O que já entra nos cálculos PvE e no Anjo da Morte são os passivos server-side de ataque, defesa, vida e crítico. Portanto, não apresentar as habilidades ativas como efeitos de combate funcionais até implementar sua resolução no servidor, regras de ativação/cooldown e testes de equilíbrio.

## 10. Sequência de liberação

| Ordem | Entrega | Critério de aceite |
|---|---|---|
| 1 | PR #120 / base de lançamento | Revisão, CI atual e gates de release resolvidos |
| 2 | D1 Preview remoto | UUID confirmado, schema aplicado apenas no banco descartável e secrets QA isolados |
| 3 | Fluxos reais no staging | Login, jogo, loja manual web e aprovação Master testados sem dados de produção |
| 4 | Inspeção Android físico | Aparelho de entrada e intermediário/alto; toque, instalação, WebGL, memória, temperatura e retomada |
| 5 | Domínio e identidade Android | Domínio, Application ID e certificado definidos pelo proprietário |
| 6 | TWA e Digital Asset Links | TWA verificada e build reproduzível |
| 7 | Play Billing | Compra de teste validada server-side e concessão idempotente |
| 8 | Ficha e conformidade | Privacidade, Data safety, classificação e materiais reais revisados |
| 9 | Teste interno/fechado | AAB assinado instalado e fluxo completo aprovado |
| 10 | Produção | Acesso liberado no Play Console e lançamento gradual aprovado |

## 11. Segurança e preservação

Esta preparação documental não autoriza deploy, migração remota, alteração de secrets, criação de jogadores de QA na produção, alteração de saldos/inventários nem publicação de AAB. A publicação do Worker continua dependente do fluxo manual protegido, backup/Time Travel e smoke test somente de leitura.


## 9.2 Auditoria de qualidade visual — 19/11/2026

A CI comprova contratos, carregamento e renderização automatizada em Chromium; não comprova que a direção de arte já atingiu nível comercial premium. O inventário efetivo do manifesto 3D desta branch contém cinco GLBs habilitados:

- torre quadrada e muralha do pacote Kenney Castle Kit;
- trebuchet do mesmo pacote;
- árvore alta do pacote Kenney Mini Forest;
- um personagem de arqueiro.

Os cartões de heróis utilizam retratos SVG same-origin; os outros edifícios, castelo central e partes do mapa dependem majoritariamente de geometria procedural Three.js. Não há, no manifesto atual, modelos 3D exclusivos e animados para cada edifício, conjunto de heróis, dragões ou chefes dos eventos. As sete ilustrações SVG de eventos são arte de apresentação; não provam que os sete encontros estejam implementados.

A cidade usa mapas procedurais PBR aproximados por perfil: 128 px (low), 256 px (balanced) e 512 px (high). Isso é uma otimização apropriada para mobile, mas não substitui um pacote autoral premium de albedo, normal, roughness, AO, metalness quando pertinente, variações de material, LOD e animações. A própria bíblia visual classifica o sistema procedural como aproximação e prevê materiais autorais para acabamento final.

### O que está bom e deve ser preservado

- identidade visual consistente em azul-noite, azul-real e ouro;
- cidade e mapa estratégicos com linguagem geométrica coerente;
- assets locais, licença/proveniência registrada e ausência de dependência Three.js CDN;
- fallback quando WebGL falha, limite de pixels do drawing buffer e suspensão de animações em segundo plano;
- perfis low/balanced/high com Data Saver e movimento reduzido;
- alvos de toque de 48 CSS px, tipografia de campo de 16 px e áreas seguras Android;
- arte original dos sete cards de eventos e retratos SVG dos heróis.

### O que ainda falta para declarar acabamento premium

1. Modelos autorais ou licenciados com silhuetas exclusivas para castelo, quartel, fazenda, serraria, pedreira, muralha, academia e demais edifícios centrais.
2. Modelos 3D rigged e animações coerentes para Kael e os heróis principais; modelos/rigs de dragões se forem apresentados como unidades 3D.
3. Modelos e animações dos chefes de evento realmente implementados; manter Shiva, Khali e eventos em preparação identificados como prévias até terem controlador e recompensa server-side.
4. Materiais PBR autorais com variação por superfície, mipmaps, LOD e budgets definidos por GPU; preservar o fallback procedural para aparelhos de entrada.
5. Iluminação/sombras e efeitos testados por aparelho; não aumentar sombras, anisotropia ou resolução apenas para tornar uma captura mais bonita.
6. Comparação visual lado a lado de cidade, mapa, heróis, equipamento, aliança, eventos e combate, evitando estilos low-poly/cartoon/realista misturados sem direção artística.
7. Capturas reais em Android, não screenshots conceituais, para a ficha Play Store.

### Critério de desempenho real

O sampler atual coleta intervalos entre callbacks `requestAnimationFrame`; ele não mede diretamente o tempo de GPU, o FPS sustentado após aquecimento térmico ou a memória gráfica real. A aprovação de Chromium/Playwright não substitui aparelhos físicos.

Para cada aparelho Android de teste, registrar:
- modelo, versão Android, RAM, GPU, navegador/WebView e densidade;
- tempo de abertura e tempo até a cidade utilizável;
- FPS observado e p50/p95 dos intervalos de frame durante pelo menos 10 minutos;
- memória do processo e estabilidade WebGL/context lost;
- temperatura/throttling percebidos, consumo e estabilidade após alternar telas;
- qualidade legível do HUD/toque no viewport 360 px e em tela de alta densidade;
- instalação PWA, atualização do Service Worker, retomada, perda/retorno de rede e sessão autenticada.

**Decisão:** a camada Android está tecnicamente preparada para continuar o beta, mas a arte 3D é uma base evolutiva, não uma versão final de alto orçamento. Não prometer visual equivalente a um MMO mobile premium nem publicar material de loja que mostre funcionalidades/arte que não aparecem na build real. A aprovação visual final depende de assets, testes físicos e revisão humana.
