# Auditoria funcional — Clash of Izzy

**Atualizado em 17/11/2026.** Este documento separa o que existe no código, o que foi validado automaticamente e o que ainda não corresponde ao jogo 4X planejado. Código presente não é sinônimo de funcionalidade validada em Preview, produção ou Android físico.

## Escopo do produto

Jogo de estratégia medieval 4X, persistente e prioritariamente móvel: desenvolver um reino, produzir recursos, construir, pesquisar, treinar exércitos, explorar e disputar o mapa, cooperar em alianças, participar de eventos mundiais e progredir com heróis e cosméticos.

## Estado por sistema

| Sistema | Estado confirmado na branch | Lacuna para o resultado desejado |
|---|---|---|
| Reino e economia | Estado persistente em Cloudflare D1; produção e operações econômicas executadas no servidor | Falta telemetria econômica e balanceamento com partidas reais; auditar ledger para todas as fontes e saídas |
| Construção | Filas persistentes; conclusão calculada/resolvida pelo Worker e Cron | Uma fila por faixa; faltam cancelamento, aceleração, múltiplas filas e mais progressão visual |
| Treinamento | Fila persistente; unidades são entregues ao concluir; ordem limitada a 100 unidades | Faltam promoção de tier, lotes encadeados e mais opções de fila |
| Pesquisa | Fila persistente; níveis confirmados no servidor | Árvore ainda curta; pré-requisitos e efeitos precisam ser expandidos e balanceados |
| Exército | Catálogo de unidades e quantidades persistentes | Formação completa de marchas, reforços e counters competitivos ainda incompletos |
| Marchas | Persistentes e processadas por Cron; PvE em territórios e ataques a castelos de jogadores | Faltam retorno visual/tático completo, cerco, dano de muralha, reforços e recuperação de marcha |
| PvP entre castelos | Implementação parcial: guarnição real, perfis de atacante/defensor, escudos, bloqueio de autoataque/aliados, resolução condicional, relatórios bilaterais e replay | Não equivale a guerra completa: captura de castelo/território, saque, transferência de recursos, cerco, reforços, rally, retorno e balanceamento precisam ser concluídos |
| Mapa mundial | Mapa estratégico 3D isométrico, coordenadas, seleção, pan/zoom por Pointer Events e projeção de marcadores | Mundo ainda pequeno e limitado; não há mapa de tiles extenso, névoa de guerra persistida ou fronteiras dinâmicas |
| Alianças | Criação/entrada, membros, convites, chat, doações e guerras persistentes | Rally, reforços, ajuda temporizada, diplomacia, moderação e guerra territorial precisam de validação ponta a ponta |
| Heróis e equipamentos | Inventário, heróis, equipamentos e bônus validados no servidor | Faltam elenco, habilidades e efeitos visualmente ligados às batalhas e à progressão |
| Evento Anjo da Morte | Evento PvE mundial com vida, pontuação, ataques e recompensas persistentes | Precisa de playtest e ajuste de dificuldade/recompensas com população real |
| Loja | Pedidos auditáveis e aprovação Master idempotente; checkout Mercado Pago configurado | Confirmação automática por webhook e gateway operacional completo ainda pendentes |
| Busca mundial | FTS5, trigramas, tolerância controlada a erros, português, busca CJK por substring, ranking BM25, cache de cliente e rate limit | Não é crawler da Internet; faltam benchmark de relevância/latência e telemetria sem PII |
| Cidade 3D | Three.js 0.187.0 fixado; módulos/addons e decodificadores Draco/KTX2/Meshopt gerados same-origin; carregadores configurados; cinco GLBs no manifesto | Os GLBs originais continuam no runtime; CI compara variantes independentes Draco/Meshopt; faltam aprovação visual, profiling, LOD por cobertura em tela e Android físico |
| Renderização do mapa 3D | Three.js same-origin, câmera isométrica; árvores do terreno e de territórios agrupadas em três InstancedMesh batches, com bounds recalculados e frustum culling | Medir draw calls, sombras, overdraw e frame time em Android; controles pan/zoom permanecem Pointer Events/CSS |
| PWA/offline | Service Worker v32; shell, módulos Three.js/addons, Draco/Basis decoders e GETs same-origin cacheados; /api/* continua fora do cache | CI valida first import de módulos e bytes dos decodificadores offline; gameplay autenticado/D1 continua online; falta inspeção Android físico |
| Preview Cloudflare | Wrangler 4.161.0; `previews.vars.ENVIRONMENT=preview`; teste impede que Preview reutilize o D1 de produção | `previews.d1_databases` ainda ausente por falta de ID de D1 staging; Preview fica sem `env.DB` até provisionar e migrar a base isolada |
| Android físico | Relatório visual parcial de 16/11 | Cidade 3D, texturas, sombras, PWA standalone, Service Worker controlador e offline ainda pendentes |

## Estado técnico e decisões de arquitetura

- Não introduzir React: o frontend atual é HTML/CSS/JavaScript modular.
- Não duplicar a busca: manter o contrato protegido `/api/game/search`, Bearer token, cancelamento, debounce, cache e limites.
- Não criar um segundo motor de qualidade: `scripts/kingdom-quality.js` já define perfil e orçamento de pixels.
- Não trocar o mapa para OrbitControls: o mapa atual usa Pointer Events, zoom/pan CSS e uma câmera isométrica; OrbitControls disputaria os gestos e a seleção de territórios.
- Não mover a economia para Durable Objects sem benchmark e desenho de consistência. O D1 já oferece transações via `batch()` e o Worker já utiliza guardas condicionais em operações críticas.
- Three.js está fixado em 0.187.0 e os módulos/addons/decoders são gerados em /vendor/three/ por npm run vendor:three; o Service Worker v32 pré-cacheia o manifesto local.
- O pipeline npm run assets:optimize compara Draco e Meshopt em variantes independentes, valida saídas e não substitui os GLBs originais.
- O Preview marca ENVIRONMENT=preview, mas continua sem DB até existir um ID de D1 staging diferente do ID de produção.
- Os loaders da cidade e compartilhado agora registram Draco/KTX2/Meshopt nos caminhos efetivamente usados. Não comprimir os GLBs atuais antes de servir decodificadores pela mesma origem, produzir variantes testadas e medir os aparelhos.
- Não considerar IndexedDB uma garantia permanente de offline. Cache API já armazena assets GET locais; o browser pode aplicar quota/evicção tanto a Cache quanto a IndexedDB.
- Não considerar o shell offline como jogo jogável sem rede. O servidor continua sendo a fonte de verdade de saldos, filas, batalhas, compras e recompensas.

A auditoria completa e as referências oficiais estão em [auditoria-tecnica-ampliada-2026-11-17.md](auditoria-tecnica-ampliada-2026-11-17.md).

## PvP: precisão do estado

A branch auditada contém `processPvpMarch`. A rotina carrega a guarnição real do defensor, obtém os perfis dos dois reinos, valida proteção e aliança, resolve combate, devolve sobreviventes ao inventário do atacante e persiste relatório e replay para os participantes, usando compare-and-set e guarda de idempotência.

Isso **não** autoriza marcar guerra 4X como completa. Ainda é necessário implementar e testar o ciclo de captura/saque/cerco/retorno/reforços/rally e regras competitivas. O documento antigo que dizia que ataques PvP estavam bloqueados ficou desatualizado; o estado correto é **PvP parcial, com ataques a castelos e relatórios, mas sem o loop completo de guerra**.

## Evolução do mapa e da PWA

- Pan, zoom e limites de viewport são geridos por `world-map.js` e `world-map-viewport.js`; não dependem de OrbitControls.
- O canvas do mapa é isométrico e os marcadores DOM são projetados a partir da câmera.
- O Service Worker atual é `clash-of-izzy-shell-v31`. O shell central é pré-cacheado e assets GET same-origin são guardados após download.
- `/api/*` não é cacheado. Isso é intencional: não servir saldo, combate ou estado autoritativo obsoleto como se fosse atual.
- A importação de Three.js e addons por jsDelivr é um bloqueio para 3D totalmente offline; os módulos e decoders essenciais precisam ser servidos pela própria origem antes de prometer essa capacidade.

## Correções e verificações recentes

1. As migrações D1 continuam versionadas; não alterar migrações históricas já aplicadas.
2. `scripts/kingdom-quality.js` mantém uma única seleção de perfil e limita a resolução ao orçamento de pixels.
3. A cidade instancia a floresta procedural com `InstancedMesh`; o mapa ainda é candidato a instancing após profiling.
4. A busca global e a descoberta de jogadores usam o mesmo backend e os mesmos índices; não foi adicionado serviço externo de busca.
5. A CI #880 encontrou HTTP 500 em PvP por `structureDefense is not defined`; o código foi corrigido e a CI #882 posterior passou.
6. CI #882 no commit `363a983`: 266/266 testes Node, 9/9 testes Playwright, smoke read-only e Worker bundle dry-run aprovados.
7. Foi adicionado `tests/e2e/pwa-offline-cache.spec.js`, isolado com Service Worker permitido. A primeira versão falhou ao navegar top-level com o navegador offline; foi ajustada para buscar a página offline pela página controlada e verificar resposta 200/conteúdo. A CI #888 aprovou esse teste e os outros nove testes Playwright.
8. Não foi feita migração remota de D1, alteração de segredo, publicação de produção ou inspeção física nesta atualização.

## Bloqueios obrigatórios antes do merge

- Criar D1 de staging isolado para Previews; nunca apontar Preview ao database ID de produção.
- Adicionar `previews.d1_databases` com binding `DB` e database ID de staging; criar configuração própria de migração Preview apontando para o mesmo banco.
- Executar `npx wrangler preview` (este projeto é Worker com assets, não Pages).
- Confirmar health/API e `env.DB` no Preview exato da branch.
- A CI #888 já validou o teste Service Worker/GLB offline; permanece necessária a verificação no Android físico.
- Inspecionar em Android físico: viewport 360 CSS px e nativo, cidade 3D, close-up das texturas, sombras/iluminação, toque, estabilidade, PWA standalone, worker ativo/controlador e reabertura offline.
- Anexar capturas sanitizadas do deployment exato.

## Próximas prioridades reais

1. **P0 — Preview seguro:** provisionar o D1 staging, corrigir binding de Preview, aplicar migrações e publicar Preview com `wrangler preview`.
2. **P1 — 3D/offline:** unificar loaders, servir Three.js/addons/decoders localmente, comparar Draco/Meshopt/KTX2 e testar LOD/instancing com orçamento de GPU.
3. **P1 — jogo 4X:** completar captura, saque, cerco, retorno, reforços e rally; ampliar testes concorrentes entre reinos.
4. **P2 — observabilidade:** medir p50/p95 da busca, frame time, draw calls, triângulos, memória e falhas de assets; usar dados agregados e sem PII.
5. **P2 — playtests:** balancear economia, tropas e eventos com sessões reais; não publicar números de retenção/performance sem medição.

## Regras para não regredir

- Não duplicar tabelas, inventário, fila, busca ou gerenciadores de qualidade existentes.
- Não editar migrações aplicadas; criar sempre a próxima migração.
- Não tornar o cliente autoridade de economia, batalha, progressão ou recompensa.
- Não ligar Preview ao D1 de produção.
- Não ativar monetização automática ou declarar PvP completo sem testes de integração, idempotência e operação.
- Não declarar assets finais, 3D offline ou performance sustentada antes de teste real.
- Usar referências de outros jogos como inspiração funcional, mantendo arte, nomes, interface e balanceamento próprios do Clash of Izzy.
 

## Integração 3D e segurança de Preview — revisão atual

- O package.json fixa Three.js 0.187.0 e @gltf-transform/cli 4.5.1. npm run vendor:three gera vendor/three/ e o manifesto de módulos, addons, Draco WASM/JS e Basis WASM/JS.
- Import maps de kingdom.html, world.html e arena.html usam /vendor/three/; os módulos da cidade, mapa, post-processing e loader compartilhado não carregam Three.js de CDN.
- sw.js usa clash-of-izzy-shell-v32; valida o manifesto local e cacheia os arquivos na instalação. As APIs permanecem fora do cache.
- npm run assets:optimize cria variantes independentes Draco/Meshopt, valida e mede tamanho, sem trocar o manifesto. A CI gera e arquiva o relatório A/B em 3d-asset-compression-report.
- O mapa mundial usa InstancedMesh para árvores do terreno e de territórios, em três batches por grupo; os volumes são calculados após as matrizes.
- wrangler.jsonc marca ENVIRONMENT=preview. Sem D1 staging ID, env.DB não é fornecido ao Preview; não usar produção como fallback. Teste automatizado protege contra ID igual ao banco de produção.
- A CI #907 está pendente para esta integração. O Android físico e o Preview com D1 staging continuam como gates antes do merge.
