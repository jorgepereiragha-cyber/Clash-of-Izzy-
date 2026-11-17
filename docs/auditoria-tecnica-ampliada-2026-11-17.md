# Auditoria técnica ampliada — Clash of Izzy

**Data:** 17/11/2026  
**Branch auditada:** `feat/visual-quality-mobile-3d`  
**Commit auditado:** `363a983e477df3d23219179ea55681886dbe83da`  
**Commit adicional desta auditoria:** `1c2b4fedd8ef6a2a2f353105ca1ad4e49d9e8fd1`  
**PR:** [#112](https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/pull/112) — continua Draft.

## 1. Parecer executivo

A arquitetura existente não deve ser substituída. O produto já possui Worker + D1, autenticação, filas persistentes, pesquisa indexada, renderizadores Three.js, mapa estratégico, modelos GLB, Service Worker e integração de testes Worker/D1.

O maior risco atual é a diferença entre o que o código promete, o que os Previews conseguem executar e o que foi validado fisicamente. As melhorias devem ser incrementais e manter uma única fonte de verdade para o estado do reino.

**Não aplicar literalmente** as propostas de introduzir React, mover toda a economia para Durable Objects, armazenar os modelos em IndexedDB por padrão ou trocar os controles atuais do mapa por OrbitControls. Essas propostas criariam duplicação ou conflitos com a implementação existente.

## 2. Estado confirmado no código

### Backend, persistência e concorrência

- `worker.js` é a entrada principal do Worker.
- `wrangler.jsonc` vincula `env.DB` ao D1 `clash-of-izzy-db`.
- O estado do reino, economia, filas, marchas, alianças, eventos e relatórios são persistidos no D1.
- As ações mutáveis são processadas pelo servidor; o navegador envia intenções.
- O Worker já usa operações D1 em lote, verificações condicionais, tokens de resolução e guardas de idempotência em fluxos críticos.
- A resolução de ataques a castelos possui perfis de atacante/defensor, guarnição, proteção, bloqueio de autoataque/aliados, relatório bilateral e replay.

D1 `batch()` executa as instruções de forma sequencial dentro de uma transação; se uma instrução falha, a sequência é revertida. Isso já oferece uma base transacional que deve ser explorada antes de adicionar outra camada de estado. Referência: https://developers.cloudflare.com/d1/worker-api/d1-database/

### Busca

A busca global está no Worker e usa FTS5, índices de prefixo/substring, trigramas, normalização, ranking BM25, verificação fuzzy limitada e fallback LIKE. O frontend usa a sessão do jogador, cancela pesquisas antigas, aplica debounce e mantém um cache LRU curto por token.

**Não adicionar React hook nem um segundo mecanismo de busca.** O frontend atual é HTML/JS modular e a rota protegida exige o Bearer token. Qualquer refino deve preservar contrato, token, rate limit, cancelamento e sanitização de resultados.

### PvP: estado real, não o estado de documentos antigos

O documento `docs/status-4x-evolucao.md` descrevia os ataques PvP como bloqueados. Isso ficou desatualizado. A branch auditada já contém `processPvpMarch`, carregamento de guarnição, defesa, proteção, simulação, resolução condicional em D1 e relatórios/replay para os dois reinos.

Isso **não significa que a guerra 4X esteja completa**. Permanecem lacunas de produto, como captura efetiva do castelo/território, saque e transferência de recursos, cerco/dano de muralha com ciclo completo, reforços, rally, retorno de sobreviventes com marcha e balanceamento competitivo. Não declarar PvP completo até esses fluxos estarem especificados e testados ponta a ponta.

Uma CI anterior (#880) encontrou HTTP 500 no cenário de PvP por `structureDefense is not defined`. A correção entrou na branch e a CI #882 posterior passou. Esse histórico reforça a necessidade de testes reais entre dois reinos, não apenas testes de presença de strings.

### Cidade, mapa e Three.js

Há dois caminhos de carregamento 3D:

1. `scripts/kingdom-3d.js`: cidade isométrica, renderizador próprio, modelos GLB do manifesto, materiais procedurais, KTX2Loader, fallback procedural e diagnóstico local.
2. `engine/asset-loader.js`: carregador compartilhado com DRACOLoader, KTX2Loader, clone de modelos esqueléticos, ciclo de vida e descarte. Ele é usado por outra cena, como a arena, mas não é o carregador utilizado pela cidade.

A cidade já possui uma floresta procedural com `InstancedMesh` e limita a quantidade de edifícios/modelos apresentados. Portanto, instancing não está ausente do jogo. O mapa mundial ainda cria componentes de árvores como grupos/meshes individuais e é candidato a batching/instancing após profiling.

O mapa não utiliza OrbitControls. `world-map.js` aplica pan/zoom por Pointer Events e `world-map-viewport.js` limita a translação/escala de uma camada que contém o canvas 3D. A câmera do `world-map-3d.js` permanece isométrica. A cidade também usa câmera ortográfica e controles HTML projetados sobre os edifícios.

**Não introduzir OrbitControls sem redesenhar e testar todo esse contrato.** Ele pode competir com a captura de ponteiro, seleção de territórios, zoom CSS e alvos HTML.

A qualidade atual é adaptativa por capacidade declarada: memória, núcleos, limite de textura, Data Saver e preferência por movimento reduzido. A cidade também limita pixel ratio por orçamento de pixels. Isso não mede diretamente temperatura ou throttling térmico, e a Web Platform não fornece uma leitura de temperatura universal para essa decisão. O avanço correto é medir frame time, draw calls, triângulos, texturas e perda de contexto, aplicando degradação com histerese; não inferir temperatura pelo user-agent.

### Pipeline de assets

O manifesto `assets/3d/manifest.json` tem cinco assets habilitados: dois modelos, dois props e uma unidade. O pipeline de validação verifica caminhos locais, GLB 2.0, dependências, duplicidades e limites de tamanho.

A cidade já configura KTX2Loader e o associa ao GLTFLoader; ainda não configura DRACOLoader. O carregador genérico já tem Draco, mas não está ligado à cidade. Assim, comprimir um GLB da cidade com Draco antes de integrar e testar o decodificador causará falha de carregamento. Não comprimir os assets atuais às cegas.

A decisão recomendada é unificar o caminho de carregamento, fixar a versão do Three.js e empacotar localmente os decodificadores/transcodificadores necessários. Depois comparar Draco e Meshopt por tamanho, tempo de decodificação e estabilidade em aparelho real. Para texturas, KTX2/Basis exige `KTX2Loader.detectSupport(renderer)` antes de carregar texturas; o WASM e os arquivos do transcoder também precisam estar disponíveis localmente para um cenário offline. Referências:
- https://threejs.org/docs/pages/GLTFLoader.html
- https://threejs.org/docs/pages/KTX2Loader.html
- https://threejs.org/docs/pages/DRACOLoader.html
- https://gltf-transform.dev/

### PWA e offline

O Service Worker atual usa o cache `clash-of-izzy-shell-v31`. O shell é pré-cacheado; respostas GET locais, incluindo GLBs baixados durante a navegação, são adicionadas ao Cache API. Requisições `/api/*` não são interceptadas/cacheadas, corretamente, porque o estado autoritativo precisa do servidor.

O plano de colocar todos os GLBs no IndexedDB não é necessário como primeiro passo: o Cache API já faz cache dinâmico desses GET locais. IndexedDB não garante persistência permanente por si só; Cache API e IndexedDB são, por padrão, armazenamento best-effort sujeito a quota/evicção. `navigator.storage.estimate()` e `navigator.storage.persist()` podem ser usados para medir e solicitar persistência quando apropriado. Referência: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

Há, contudo, um bloqueio offline real: os módulos Three.js da cidade/mapa e os arquivos do import map são carregados de jsDelivr. O Service Worker ignora URLs cross-origin, portanto não garante que esses módulos e seus addons estejam disponíveis sem rede. O cache v31 consegue servir o shell e assets locais já descarregados, mas isso **não equivale a jogo completo offline nem garante renderização 3D offline**.

Prioridade: servir a versão fixada do Three.js, addons e decoders a partir da mesma origem. Depois, validar shell, módulos locais e GLBs previamente baixados em offline. Nunca armazenar saldo ou progresso offline como se fossem verdadeiros: construção, combate, compras e sincronização continuam server-authoritative.

### Playwright

`playwright.config.js` define `serviceWorkers: "block"` para tornar os testes com mocking previsíveis. Isso é válido para a suíte geral, mas impede validar o Service Worker real.

Foi adicionado o teste isolado `tests/e2e/pwa-offline-cache.spec.js`, que substitui essa opção por `serviceWorkers: "allow"` somente nesse arquivo. Ele verifica ativação/controle do worker, shell, cache runtime de um GLB e entrega do asset previamente baixado em offline. O teste declara expressamente que não valida jogabilidade autenticada offline.

Playwright Chromium em viewport mobile continua sendo emulação de navegador, não inspeção em Android físico. A documentação Playwright recomenda habilitar Service Workers nos testes que precisam validar seu ciclo de vida: https://playwright.dev/docs/service-workers

## 3. Conflitos do plano proposto e decisões

| Proposta enviada | Conflito encontrado | Decisão |
|---|---|---|
| Hook React para busca | React não faz parte da arquitetura; API exige token Bearer | Manter busca em JS existente |
| Novo GraphicsQualityManager | Duplica `kingdom-quality.js` e não usa o orçamento de pixels | Estender o perfil único |
| `PCFSoftShadowMap` | Não é o tipo documentado nesta versão; Three.js documenta Basic, PCF e VSM | Manter tipo suportado e comparar em dispositivo |
| Compressão Draco imediata | A cidade não conecta DRACOLoader | Unificar loader e decodificadores antes |
| Novo Worker CityState com recursos locais | Cria uma segunda fonte da verdade em relação ao D1 e o exemplo não valida autenticação/idempotência | Não migrar a economia |
| IndexedDB para todos os GLBs | Cache API já guarda GET locais; ambos podem sofrer evicção | Medir quota; continuar Cache API; usar IDB só se requisito específico justificar |
| OrbitControls | Conflita com pan/zoom CSS e Pointer Events existentes | Manter controles atuais; melhorar inércia/gestos no contrato atual |
| `wrangler pages deploy` | O projeto está configurado como Worker com `main: worker.js` e assets, não como projeto Pages | Usar Worker Previews |
| Simulação offline de gameplay | API D1 e operações sensíveis não ficam disponíveis sem rede | Testar shell/arte cacheada e explicar limites ao jogador |

### Durable Objects

Durable Objects são adequados para coordenação stateful, WebSockets, presença, sessões multiplayer ou serialização de um recurso muito disputado. A documentação Cloudflare recomenda modelá-los pelo átomo de coordenação e manter persistência importante em storage; o Worker de entrada deve autenticar, validar e formatar respostas. Não é recomendável mover todo o D1 para um objeto por cidade sem benchmark e plano de migração.

O exemplo recebido também tem defeitos: `storage.get()` é assíncrono e não pode ser tratado como valor booleano síncrono no construtor; as operações não são aguardadas; o endpoint aceita alteração de ouro fornecida pelo cliente; faltam autenticação, validação, limite e idempotência; e a rota WebSocket não realiza upgrade. Não utilizar esse código.

Decisão: manter D1 como fonte de verdade do estado atual. Reavaliar Durable Objects para presença, chat ao vivo ou coordenação de eventos/rally quando houver requisito mensurável. Referência: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/

## 4. Bloqueio objetivo de Cloudflare Preview

O projeto usa Wrangler `4.161.0`, versão acima do mínimo atual `4.135.0` para Worker Previews. O comando correto é:

```bash
npx wrangler preview
```

Não usar `wrangler pages deploy` para este Worker.

O `wrangler.jsonc` atual tem `previews: {}` e declara D1 somente na configuração de produção. Cloudflare documenta que Previews não herdam automaticamente bindings de storage/DB de produção. Assim, o Preview pode existir e ainda assim ter `env.DB` ausente. Não apontar o Preview para o database ID de produção.

Caminho seguro:
1. Criar um D1 de staging/Preview isolado e guardar o ID real retornado pela Cloudflare.
2. Declarar `previews.d1_databases` com o mesmo binding `DB`, mas com o ID do banco de staging.
3. Criar `wrangler.preview-migrations.jsonc` apontando para o mesmo banco de staging.
4. Aplicar migrações usando `npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc`.
5. Executar `npx wrangler preview` e confirmar `env.DB`, health, autenticação e ações de teste.

O ID de staging não está disponível no repositório nem foi provisionado nesta auditoria. Por isso, não foi escrito um UUID fictício, não foi vinculado o banco de produção e nenhuma migração remota foi executada.

Referências:
- https://developers.cloudflare.com/workers/previews/get-started/
- https://developers.cloudflare.com/workers/previews/configuration/
- https://developers.cloudflare.com/workers/previews/resources/

## 5. Ordem correta de aprimoramento

### P0 — liberar Preview seguro e evidência reproduzível
- Provisionar D1 staging, configurar o binding Preview e aplicar migrações ao staging.
- Executar Preview pelo Wrangler e confirmar as rotas/API em ambiente com DB.
- Manter a PR Draft até a inspeção física Android.

### P1 — fechar o caminho 3D/offline
- Unificar os loaders da cidade e das cenas; remover dependência de CDN para módulos e decoders essenciais.
- Validar Draco/Meshopt e KTX2/Basis por benchmark; não converter todos os modelos automaticamente.
- Acrescentar LOD real para objetos distantes, instancing para vegetação repetitiva do mapa e descarte de recursos em troca de cena.
- Medir frame time e GPU no perfil low/balanced/high, com degradação gradual e histerese.

### P1 — completar os loops de jogo
- Especificar captura, saque, dano de muralha, retorno, reforço e rally do PvP.
- Testar concorrência real: duas ordens sobre mesmo reino/alvo, escudos, membros aliados, repetição da chegada e falha parcial.
- Balancear economia, filas, custos, progressão e combate com dados de playtest, mantendo o Worker autoritativo.

### P2 — telemetria, busca e qualidade contínua
- Benchmark anotado da busca (PT/EN/CJK) e latência p50/p95, sem dados privados.
- Telemetria agregada de frame time, draw calls, triângulos, tamanho de assets, falhas GLB e perda de contexto.
- Medir retenção e estabilidade somente após testes com jogadores reais, sem fabricar números.

## 6. Evidências automatizadas e limites

A CI #882 no commit `363a983` concluiu com sucesso: 266/266 testes Node, 9/9 Playwright, smoke test read-only e bundle Worker dry-run. A execução anterior #880 falhou em um caso de PvP com erro de variável não definida; o commit auditado posterior já passou. O novo teste PWA/offline foi acrescentado no commit `1c2b4fedd8ef6a2a2f353105ca1ad4e49d9e8fd1`; sua CI precisa confirmar esse teste antes de considerar a adição validada.

A aprovação de CI não comprova:
- deployment Preview no commit atual;
- D1 staging ligado ao Preview;
- runtime 3D no Android físico;
- Service Worker ativo e controlador em aparelho;
- instalação PWA standalone ou reabertura offline;
- temperatura, FPS sustentado ou consumo de memória em cinco minutos;
- balanceamento com população real.

**Nenhuma alteração no banco remoto, segredo, produção ou estado de jogadores foi feita nesta auditoria.**


## 5. Revisão aprofundada do código externo enviado — 17/11/2026

### Pilar 1 — Draco, KTX2, Meshopt e LOD

O código proposto não deve ser aplicado como está.

- Criar um novo THREE.WebGLRenderer dentro de setupOptimizedLoaders() abre um segundo contexto WebGL apenas para consultar capacidades de textura. Isso desperdiça recursos e pode esgotar o limite de contextos. KTX2 deve receber o renderer que já desenha a cena; a cidade já fazia corretamente ktx2.detectSupport(renderer).
- O carregador da cidade era o caminho efetivo para os GLBs do manifesto, mas só registrava KTX2. Foi atualizado para registrar DRACOLoader, KTX2Loader e MeshoptDecoder; o carregador compartilhado também registra Meshopt e já tinha Draco/KTX2. O Draco loader é descartado junto com os recursos da cena.
- Meshopt não substitui Draco; são formatos de compressão distintos. GLTFLoader exige que cada decodificador correspondente seja configurado para a extensão presente no GLB. Documentação: https://threejs.org/docs/pages/GLTFLoader.html.
- KTX2 precisa de detectSupport(renderer) antes de carregar as texturas, e o transcoder WASM/JS precisa estar acessível. O projeto ainda aponta esses arquivos para CDN; portanto, a inicialização 3D não está garantida em modo offline. Documentação: https://threejs.org/docs/pages/KTX2Loader.html.
- Não foi aplicado matrixAutoUpdate = false globalmente. Isso pode quebrar nós animados e hierarquias de esqueleto; o projeto tem unidades com animações e usa SkeletonUtils.clone() para clonar rigs.
- Não foi criado THREE.LOD baseado apenas na distância. A cidade usa câmera ortográfica: a distância ao olho não corresponde diretamente ao tamanho em pixels do edifício. A solução correta é LOD por cobertura/tamanho em tela ou variantes de qualidade calibradas para a projeção. Hoje não há pares de GLBs high/low no manifesto.
- O clone() comum não substitui o clone de esqueleto usado pelo projeto; geometria, materiais e texturas também precisam de uma política explícita de compartilhamento e descarte. O exemplo proposto não implementa essa gestão.
- O exemplo não deduplica Promises de carregamento, armazena no cache somente a URL alta (ignorando a variante/limite LOD), e falha toda a operação se o arquivo low não carregar, mesmo quando o high já foi carregado.
- As URLs de Draco/Basis em CDN não resolvem o objetivo offline. Os arquivos dos decodificadores/transcodificadores devem ser versionados e servidos pela mesma origem antes de declarar 3D offline.

Decisão aplicada: suporte de decodificação foi ligado nos dois caminhos GLTF ativos, sem recomprimir os arquivos existentes. A ativação de LOD e compressão física dos GLBs continua condicionada à geração de variantes, inspeção visual e benchmark de tamanho, decodificação, VRAM e frame time.

### Pilar 2 — Durable Objects e estado atômico

A ideia de serializar ações concorrentes em uma unidade de coordenação é válida, mas o exemplo recebido abre uma vulnerabilidade de economia:

- O cliente controla action.cost, buildingId e o tipo de ação; um atacante pode mandar custo zero, custo negativo ou IDs arbitrários.
- Não existe autenticação do jogador, autorização de propriedade da cidade, validação de catálogo/requisitos, limite de corpo, rate limit ou idempotência por actionId.
- A operação grava um segundo estado (gold, wood, buildings) fora da fonte de verdade D1. Isso permite divergência entre Worker/D1 e DO, mesmo que a transação dentro do DO seja atômica.
- O exemplo não implementa WebSocket; portanto, não fornece atualização em tempo real só por declarar uma classe Durable Object.

A documentação Cloudflare recomenda transaction() para read-modify-write atômico dentro do Storage do próprio Durable Object e recomenda usar blockConcurrencyWhile() com parcimônia. Isso não torna atômicas operações que atravessam D1, DO e serviços externos. Referências: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ e https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/.

Decisão: manter D1 como autoridade da economia e estado persistente. Um DO pode ser introduzido em uma etapa própria para presença, chat, WebSocket, coordenação de rally/evento ou serialização de uma entidade concorrida, com identidade derivada no servidor e teste de carga. Não registrar bindings/migrations de uma classe que ainda não tem contrato de autenticação, estado e reconciliação definido.

### Pilar 3 — Cache API, IndexedDB e Service Worker

A premissa de que Cache API falha por ser GLB grande não é uma regra da plataforma. Cache API foi feita para pares Request/Response e está disponível dentro de Service Workers. Como outros armazenamentos do navegador, usa quota e está sujeito a evicção. IndexedDB também é armazenamento best-effort por padrão; não garante persistência permanente. Referências: https://developer.mozilla.org/en-US/docs/Web/API/Cache e https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria.

O Service Worker atual já pré-cacheia o shell e adiciona GETs same-origin bem-sucedidos ao cache em runtime, incluindo GLBs locais. Ele ignora /api/*, métodos que não sejam GET e origens externas. Substituí-lo pelo exemplo proposto quebraria esse contrato:

- O caminho real é /sw.js e o projeto serve assets a partir da raiz; public/sw.js, /src/main.js e /src/style.css não correspondem à estrutura atual.
- O fetch proposto intercepta métodos e origens sem exclusões de segurança; isso pode interferir em POSTs de API e requisições cross-origin.
- await store.get(...) e await objectStore.put(...) não aguardam o resultado de IndexedDB: ambos retornam IDBRequest, não Promises. É necessário aguardar request.onsuccess/onerror e transaction.oncomplete/onabort.
- Chavear só por url.pathname pode colidir entre query/versionamentos; a DB também não fecha conexões e não administra quota/erro/aborto.
- Se o navegador já guarda os mesmos bytes no Cache API e no IndexedDB, o custo de armazenamento pode ser duplicado. Os dois mecanismos compartilham limites de quota por origem.

Decisão: manter Cache API para respostas HTTP de assets locais. Avaliar IndexedDB apenas para catálogo/versionamento, downloads offline selecionados ou metadados que precisem de consulta indexada. Medir navigator.storage.estimate() e pedir navigator.storage.persist() quando apropriado, sem prometer que o navegador sempre aprovará. Primeiro, servir Three.js, addons, Basis e Draco pela própria origem para resolver o bloqueio atual de 3D offline.

### Pilar 4 — Pipeline de otimização

O script enviado depende de instalação global não versionada, pressupõe pastas public/assets/raw que não existem no projeto, não lê o manifesto real, não gera LOD, não verifica a saída e captura erros sem terminar com código de falha. Isso pode produzir um build aparentemente verde com assets ausentes ou inválidos.

A ferramenta recomendada para estudar um pipeline reproduzível é glTF Transform, cuja CLI documenta inspect, validate, compressão Draco, Meshopt e texturas KTX2/Basis: https://gltf-transform.dev/cli. O transform deve operar sobre uma cópia de entrada, gerar saídas separadas por variante, validar cada saída, comparar tamanho e preservar fallback original. Não aplicar compressão em lote sem revisar os GLBs no renderer e testar dispositivo real.

A redução de download de Draco não equivale automaticamente à redução proporcional de memória GPU. KTX2/Basis pode permitir texturas comprimidas nativamente, dependendo dos formatos suportados pelo aparelho; o tempo de decodificação e a qualidade visual também importam. Nenhum desses formatos garante 60 FPS por si só.

### Mudanças feitas nesta atualização

1. scripts/kingdom-3d.js: registrou DRACOLoader e MeshoptDecoder no GLTFLoader da cidade, mantendo KTX2Loader.detectSupport(renderer) com o renderer existente; acrescentou descarte do loader Draco nos dois caminhos de limpeza.
2. engine/asset-loader.js: registrou MeshoptDecoder no GLTFLoader compartilhado, que já tinha Draco e KTX2.
3. tests/e2e/pwa-offline-cache.spec.js: trocou a navegação top-level que falhava após context.setOffline(true) por um fetch feito pela página já controlada, verificando HTTP 200 e conteúdo da página offline, além de continuar verificando o GLB offline.
4. Não foram convertidos GLBs, adicionados assets LOD, criada classe Durable Object, criada base IndexedDB, alterada economia, executadas migrations remotas, alterados secrets ou feito deploy de produção.

### Validação CI e bloqueios restantes

A CI #888 no commit `fa9dcfa` terminou com **sucesso**: migrações D1 locais, validação do Service Worker, manifesto e GLBs, testes Worker/D1, **10/10 testes Playwright Chromium**, diagnóstico de produção somente leitura, smoke read-only e bundle do Worker aprovados. Isso valida a alteração de teste do Service Worker e a configuração dos loaders em CI. Não substitui teste de inicialização real com modelos Draco/KTX2/Meshopt, inspeção em Android físico ou gameplay offline.

Para Preview Cloudflare, continua faltando um D1 de staging real. A documentação atual confirma que os bindings de Preview devem apontar para recursos de teste, e que D1 migrations devem ser aplicadas na mesma base utilizada por previews.d1_databases: https://developers.cloudflare.com/workers/previews/resources/. Sem o database_id de staging, não inserir placeholder e não reutilizar o ID de produção.

### Próxima sequência técnica

1. **Concluído:** CI #888 verde para teste offline, decodificadores registrados, Worker bundle e suíte automatizada.
2. Provisionar D1 staging e configurar previews.d1_databases sem tocar no banco de produção.
3. Servir módulos Three.js, addons e decodificadores same-origin; confirmar inicialização 3D offline em Chromium e Android.
4. Gerar variantes high/low e decidir LOD por tamanho em tela na câmera ortográfica; medir por perfil gráfico.
5. Criar pipeline inspect -> transform -> validate -> compare, com rollback para os GLBs originais.
6. Só depois de benchmark definir se existe um domínio de estado que justifique Durable Objects; manter D1 autoritativo enquanto isso.
