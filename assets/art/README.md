# Clash of Izzy — arte e texturas

## Direção visual
- Combinar três metas de produção comuns em jogos de alto nível: silhuetas estilizadas e leitura imediata, materiais PBR consistentes e acabamento artesanal de cenário, sempre com orçamento de GPU adequado a Android.
- Usar referências internacionais como inspiração técnica, sem copiar personagens, marcas, mapas ou assets protegidos de outros jogos.
- Fantasia medieval original, com leitura clara em telas pequenas.
- Materiais: pedra desgastada, madeira escura, telhados cerâmicos, campos, caminhos de terra e vegetação.
- Silhuetas e paleta devem distinguir cada edifício mesmo sem depender de texto.
- Cosméticos nórdicos (Odin, Thor, Freyja, Loki e Týr) devem ser visuais; não conceder atributos de combate.

## Pipeline de assets 3D
1. Modelar em Blender com escala e pivô consistentes.
2. Exportar GLB/glTF com materiais PBR e nomes estáveis.
3. Reduzir polígonos e texturas por nível de detalhe (LOD).
4. Preferir KTX2/Basis Universal para texturas GPU-compressed quando suportado pelo pipeline e validado em Android; manter fallback WebP/PNG.
5. Reutilizar materiais, atlas e instâncias para reduzir draw calls.
6. Verificar transparência, mipmaps, iluminação, memória e carregamento em aparelhos Android modestos.
7. Versionar assets e nunca sobrescrever um GLB em uso sem atualizar seu manifesto/cache.

## Cena atual
- `kingdom.html` mantém a arte procedural 2D em Canvas como fallback para WebGL indisponível.
- `scripts/kingdom-3d.js` adiciona uma cena isométrica Three.js com terreno, estrada, árvores, iluminação, até 16 edifícios 3D procedurais e mapas de textura tileáveis gerados por código para pedra, madeira, telhado, grama e estrada.
- A vegetação usa `InstancedMesh` para agrupar partes repetidas em poucos draw calls. Os modelos procedurais antigos liberam geometrias e materiais próprios ao serem substituídos; texturas compartilhadas permanecem em cache.
- `kingdom.html` declara um import map para que `GLTFLoader` e `KTX2Loader` resolvam a mesma instância do módulo `three` no navegador.
- `assets/3d/manifest.json` é o catálogo versionado para substituição explícita por modelos GLB reais (`enabled: true`). O manifesto atualmente contém cinco entradas CC0 do Kenney habilitadas: duas estruturas (torre e muralha), dois props (trebuchet e árvore) e uma unidade (arqueiro). Os arquivos locais passam pela validação estrutural e de orçamento do CI. São assets reais de base, não a cobertura artística final de todos os edifícios, tropas, heróis, animações e cosméticos.
- O carregador usa `GLTFLoader` e `KTX2Loader`/Basis Universal. Texturas KTX2 só serão usadas quando um GLB real com `KHR_texture_basisu` for adicionado e testado.
- A cena 3D é renderizada sob demanda, sem loop contínuo; não há animação de câmera ou ciclo de jogo nesta tela ainda.

## Regras de desempenho
- Canvas 2D fallback limita DPR a 1.5. Three.js escolhe perfis low/balanced/high por memória, núcleos reportados, largura da viewport e limite de textura da GPU; os tetos de DPR são 1.0/1.25/1.5.
- O framebuffer 3D também respeita orçamento de pixels por perfil (1.2/2.4/4.2 milhões), recalculado na inicialização e em cada `ResizeObserver`/resize para evitar picos em telas altas e HiDPI.
- Sombras 3D ficam desativadas no perfil low e no perfil balanced com viewport até 1024 px; o perfil high pode ativá-las com shadow map limitado por tier.
- Manter modelos procedurais como fallback até cada GLB real estar validado e habilitado no manifesto.
- GLB clones são anexados explicitamente à cena; carregamentos assíncronos reaplicam o estado mais recente do reino para evitar modelos obsoletos após atualização rápida.
- Se o contexto WebGL for perdido, desconectar observadores de tamanho, descartar o renderer e impedir novas chamadas de renderização; o Canvas 2D assume a exibição.
- Canvas decorativo não intercepta toques; controles HTML permanecem acessíveis.
- Respeitar `prefers-reduced-motion`.
- Testar em Android real antes de elevar resolução, sombras ou efeitos.


## Referências de engenharia aplicadas
- Three.js recomenda limitar a resolução interna em telas HiDPI para evitar carga excessiva de GPU; o projeto aplica um teto de pixels por perfil também após redimensionamento.
- Khronos KTX2/Basis mantém texturas em formato comprimido na GPU quando o hardware permite; adotar apenas junto de assets reais validados e manter fallback.
- Android Developers recomenda medir CPU/GPU por cena, comparar antes/depois e observar consistência de frames e carga térmica em dispositivos reais.
- Durable Objects com WebSocket Hibernation e mensagens agrupadas são uma opção futura para salas multiplayer, com estado persistido fora da memória volátil.
- Perfis do navegador não conseguem ler de forma confiável o estado térmico nativo de todos os Androids; não simular essa informação nem prometer FPS sem testes físicos.


## Budgets adaptativos de cena (validados em CI)
- Tier low: até 8 edifícios visíveis, DPR máximo 1.0, orçamento de 1,2 milhão de pixels e sombras desligadas.
- Tier balanced: até 12 edifícios visíveis, DPR máximo 1.25 e orçamento de 2,4 milhões de pixels.
- Tier high: até 16 edifícios visíveis, DPR máximo 1.5 e orçamento de 4,2 milhões de pixels.
- O limite de pixels tem precedência sobre qualquer piso de resolução; em viewports extremos o DPR pode cair abaixo de 0.5 para não exceder o orçamento.
- A quantidade de edifícios afeta apenas a representação 3D visível; o estado completo continua no servidor e na interface de gestão.


## Referências técnicas e decisões de plataforma
- Three.js WebGLRenderer usa WebGL 2 e precisa de `.dispose()` para liberar recursos GPU: https://threejs.org/docs/pages/WebGLRenderer.html
- Instâncias devem ser usadas para objetos repetidos e também precisam de descarte explícito: https://threejs.org/docs/pages/InstancedMesh.html
- glTF 2.0 é o formato runtime de entrega de cenas, meshes, materiais PBR, animações e hierarquias: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Khronos mantém registro oficial de especificações e extensões glTF: https://registry.khronos.org/glTF/
- Android ADPF/ Thermal API pode informar estresse térmico em uma aplicação nativa; a PWA atual não lê diretamente o PowerManager, então não inventa estado térmico via JavaScript: https://developer.android.com/games/optimize/adpf/thermal
- Para um futuro shell Android nativo, reduzir frame rate, tesselação, sombras e carga de CPU/GPU quando houver estresse térmico, e validar frame pacing em aparelhos reais.

## Gaps reais antes de chamar a cidade de "arte final"
- O castelo Meshy texturizado ainda não foi baixado nem incorporado; a cena usa o castelo procedural como fallback.
- O manifesto GLB existe, mas ainda está vazio; nenhum modelo artístico GLB/KTX2 real foi publicado no projeto.
- O pipeline está preparado para GLB/Draco/KTX2, mas precisa de assets licenciados, validação de tamanho, LOD e testes visuais em Android físico.
- Não marcar o trabalho como concluído só porque o módulo 3D ou o bundle compila.


## Polimento visual mobile — novembro de 2026

- A landing page usa a ilustração vetorial original `/assets/art/landing-kingdom.svg`, separando a arte panorâmica do brasão e dos ícones PWA.
- Texturas procedurais do reino usam 128 px no perfil low, 256 px no balanced e 512 px no high. A escolha considera memória, núcleos, limite de textura e Data Saver; a largura CSS da tela não rebaixa sozinha um Android capaz.
- O atlas das duas famílias de modelos Kenney permanece local em 512 × 512 px. A árvore GLB foi mantida em um único ponto do terreno para não coincidir com uma instância da floresta procedural.
- O Service Worker inclui a ilustração da landing page no shell e passa a usar cache v31 para invalidar os recursos estáticos anteriores e entregar a Landing sem navegação de gameplay.
