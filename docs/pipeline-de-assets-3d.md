# Pipeline de assets 3D — Clash of Izzy

## Formato mestre

Usar Blender como ferramenta de autoria e glTF 2.0/GLB como formato de entrega ao cliente Three.js. Preferir GLB para pacotes autocontidos. O GLTFLoader do Three.js oferece suporte a extensões de compressão e materiais; validar compatibilidade de cada extensão nos dispositivos alvo.

## Convenção de nomes

- `env_*`: cenário e terreno.
- `bld_*`: edifícios.
- `hero_*`: heróis.
- `dragon_*`: dragões.
- `unit_*`: tropas.
- `prop_*`: objetos decorativos.
- `ui_*`: recursos visuais de interface.

Usar nomes estáveis para arquivos, objetos, materiais, esqueletos e animações. Não depender de índices numéricos do Blender.

## Requisitos por asset

Cada asset deve registrar:
- nome e categoria;
- arquivo fonte Blender;
- arquivo GLB exportado;
- licença e procedência;
- dimensões e escala;
- materiais e texturas;
- animações disponíveis;
- LODs e colisores;
- tamanho comprimido;
- cena em que é utilizado.

## Orçamento inicial de performance

Os valores abaixo são metas de protótipo, não limites universais. Medir em aparelhos Android de entrada e intermediários e ajustar com profiling.

- Evitar draw calls desnecessárias; compartilhar materiais.
- Usar instancing para árvores, rochas, casas repetidas e tropas em formação quando adequado.
- Usar LOD ou simplificação para objetos distantes.
- Limitar luzes dinâmicas e sombras em dispositivos modestos.
- Preferir colisores simples a malhas de renderização.
- Carregar por região/cena e descarregar recursos fora de uso.
- Liberar recursos GPU explicitamente quando objetos forem removidos.
- Comprimir geometria e texturas após validar qualidade e compatibilidade.

## Aprovação

Nenhum pacote de arte entra na branch principal sem:
1. abrir corretamente no visualizador GLB;
2. aparecer na cena Three.js com escala e orientação corretas;
3. manter materiais e animações;
4. passar inspeção visual em Android;
5. cumprir o orçamento de memória e carregamento definido para a cena.


## Validação automatizada do manifesto v2

O comando `npm run assets:validate` valida as listas `models`, `props` e `units`, IDs e caminhos duplicados, arquivos locais sem traversal nem fuga por link simbólico, assinatura e estrutura GLB 2.0, dependências de imagem/buffer locais e os limites de 12 MiB por GLB e 48 MiB no conjunto habilitado. A verificação não baixa URLs, não executa modelos e não substitui o Khronos glTF Validator nem a inspeção visual em Android.

## Materiais periódicos e expansão visual

A grade de pedra, telhado e estrada usa células periódicas e reaproveita as cores das peças que atravessam a borda. Isso corrige a descontinuidade geométrica das juntas sem aumentar a resolução ou criar novas texturas por edifício. O grão e os demais materiais ainda exigem inspeção visual de emendas. Os testes verificam cobertura e repetição das células; não substituem a comparação de capturas no Android.

Fontes candidatas, não importadas nem aprovadas automaticamente:

- Quaternius Medieval Village MegaKit (CC0): https://quaternius.com/packs/medievalvillagemegakit.html — módulos de fachadas, portas, telhados, forjas e mercados. Conferir os arquivos efetivamente disponíveis na edição gratuita.
- Kenney Medieval RTS (CC0): https://kenney.nl/assets/medieval-rts — referência de leitura isométrica e fallback 2D; não tratar sprites como modelos GLB.
- Poly Haven (CC0): https://polyhaven.com/a/cobblestone_01 e https://polyhaven.com/a/rock_01 — candidatos a calçamento e pedra; reduzir resolução antes de inclusão.
- ambientCG (CC0): https://docs.ambientcg.com/license/ — materiais PBR; confirmar arquivo, licença e orçamento antes da inclusão.
- Three.js: https://threejs.org/manual/pages/color-management.html — albedo em sRGB, normal e roughness em NoColorSpace.

Importar somente modelos/arquivos autorizados e versionados localmente, com procedência e sem dependência de CDN. Usar o manifesto v2 existente; não criar outro carregador. Manter a identidade artística do Clash of Izzy, sem extrair recursos de outros jogos.
