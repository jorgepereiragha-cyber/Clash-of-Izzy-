# Clash of Izzy — arte e texturas

## Direção visual
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
A cidade em `kingdom.html` usa arte procedural 2D em Canvas: terreno, trilhas, vegetação, sombras e volumes estilizados dos edifícios. Isso é um marco visual leve, não substitui os modelos GLB finais nem deve ser descrito como cidade 3D real.

## Regras de desempenho
- DPR limitado a 1.5 na camada de arte da cidade.
- Redesenhar em mudança de tamanho, sem loop de animação permanente.
- Canvas decorativo não intercepta toques; controles HTML permanecem acessíveis.
- Respeitar `prefers-reduced-motion`.
- Testar em Android real antes de elevar resolução, sombras ou efeitos.
