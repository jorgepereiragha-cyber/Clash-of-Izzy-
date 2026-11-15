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
