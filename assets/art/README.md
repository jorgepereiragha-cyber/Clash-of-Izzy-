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
- `scripts/kingdom-3d.js` apresenta uma cena isométrica Three.js com terreno, estrada, árvores, iluminação e edifícios procedurais com texturas tileáveis. A cena WebGL permite até 8/12/16 edifícios visíveis nos perfis low/balanced/high. Os alvos HTML seguem a projeção da câmera e ficam compactos acima de nove itens; o fallback Canvas 2D mantém nove edifícios para preservar a legibilidade e o toque em dispositivos sem WebGL. As coordenadas canônicas persistidas têm prioridade; a disposição 4×4 só é usada quando faltam coordenadas, sem alterar o D1.
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
- Tier balanced: até 12 edifícios 3D visíveis, DPR máximo 1.25 e orçamento de 2,4 milhões de pixels; fallback Canvas 2D mantém nove.
- Tier high: até 16 edifícios 3D visíveis, DPR máximo 1.5 e orçamento de 4,2 milhões de pixels; fallback Canvas 2D mantém nove.
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
- O manifesto GLB não está vazio: contém cinco assets CC0 genéricos da Kenney habilitados (torre, muralha, trebuchet, árvore e arqueiro). Ainda não há modelos GLB artísticos próprios para o castelo, os demais edifícios, o elenco de heróis e as demais tropas, nem um pacote artístico KTX2 final.
- O pipeline está preparado para GLB/Draco/KTX2, mas precisa de assets licenciados, validação de tamanho, LOD e testes visuais em Android físico.
- Não marcar o trabalho como concluído só porque o módulo 3D ou o bundle compila.


## Arte original dos eventos

O catálogo `assets/art/events/` contém sete ilustrações SVG vetoriais originais para os cards da central de eventos. Foram desenhadas para renderização rápida no Android, sem dependência de CDN, fontes remotas ou imagens raster de grande resolução. Cada arquivo possui título/descrição acessíveis e usa a paleta medieval azul-real, dourado e sombras profundas. As imagens de Shiva e Khali são simbólicas e respeitosas; não reproduzem imagens religiosas existentes.

As artes representam a identidade visual planejada, não comprovam a implementação dos respectivos combates. O estado funcional continua sendo definido pelo Worker: Anjo da Morte é jogável; Valhalla depende da configuração sazonal; os outros cinco aparecem como experiências em preparação com recompensas explicitamente classificadas como prévias.


## Retratos do elenco de heróis

`assets/art/heroes/portraits.svg` contém retratos vetoriais originais e leves para o elenco inicial e os heróis sazonais. O sprite é servido no mesmo domínio e pré-carregado pelo Service Worker v42; os cartões usam fragmentos SVG por herói, sem CDN ou imagens externas. Heróis sem arte individual usam um retrato de arquétipo (guarda, arqueiro, cavaleiro, suporte, comandante ou mago), evitando cartões vazios.

Os atributos de apresentação vêm do catálogo canônico `hero-catalog.js` e, para heróis sazonais, do catálogo D1 de Valhalla. A fórmula aplica o crescimento de nível e estrela uma única vez; os valores-base de cada raridade não recebem um segundo multiplicador de raridade.

O mesmo catálogo define passivos de combate específicos por herói. Eles progridem de 45% do valor máximo na primeira estrela/nível até 100% no nível e estrelas máximos. Os perfis têm limites por atributo: ataque até 2,8%, defesa até 2,2%, vida até 1,6% e acerto crítico até 1,2%. O Worker calcula esses valores e os aplica ao PvE e ao Anjo da Morte; o cliente só os apresenta. Os limites globais do simulador (30% para ataque, defesa e vida) continuam em vigor. PvP não é declarado como beneficiado por esta camada.

A convocação padrão usa 70% comum, 25% raro e 5% lendário. O pool atual possui quatro comuns, cinco raros e quatro lendários, correspondendo a 17,5%, 5% e 1,25% por herói, respectivamente. Uma convocação custa 100 gemas; dez custam 900. Repetições entregam 5, 15 ou 40 fragmentos conforme a raridade. Não há garantia de lendário em um número fixo de tentativas; heróis sazonais de Valhalla não fazem parte do sorteio padrão.

## Ilustrações raster opcionais

Duas imagens CC0 de SpriteCook integradas à galeria por chave de herói; veja `heroes/illustrations/CREDITS.md`. O SVG canônico permanece como fallback. Carregamento lazy e erro de imagem recuperável.
