# Tecnologias gratuitas e pipeline de produção — Clash of Izzy

Este documento registra ferramentas gratuitas/open-source que podem ser usadas comercialmente conforme as licenças de cada ferramenta. **Ferramenta gratuita não significa que todo modelo, textura, fonte, música ou plugin encontrado nela seja livre para o jogo.** Cada asset precisa de licença e autoria registradas.

## Decisão de arquitetura

Manter o runtime atual: Three.js 0.187.0, glTF/GLB, Cloudflare Workers e D1. Não migrar para outra engine apenas por popularidade. Godot é uma alternativa open-source excelente, mas introduzir uma segunda engine agora duplicaria runtime, build, assets e manutenção. Só reconsiderar se uma prova de conceito demonstrar benefício mensurável para Android nativo.

## Ferramentas recomendadas

| Área | Ferramenta | Uso no projeto | Licença / cuidado |
|---|---|---|---|
| Modelagem, rig e animação 3D | [Blender](https://www.blender.org/) | Castelos, tropas, monstros, armas, animações e exportação GLB | GPL; arquivos criados são do artista, sujeitos às licenças dos assets incorporados |
| Pintura e texturas | [Krita](https://krita.org/) | Texturas pintadas, ícones, concept art e mapas 2D | GPLv3; a arte criada pelo usuário pertence ao criador |
| Edição raster | [GIMP](https://www.gimp.org/) | Recorte, composição, mapas de textura e tratamento de imagens | GPL; conferir licenças das imagens de origem |
| Validação de modelos | [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) | Detectar GLB malformado, referências quebradas e problemas da especificação | Projeto Khronos; validar a licença da distribuição escolhida |
| Otimização de geometria | [meshoptimizer / gltfpack](https://meshoptimizer.org/) | Reduzir dados, otimizar cache de vértices e preparar LOD/GLB | MIT para meshoptimizer/gltfpack |
| Otimização de glTF | [glTF Transform](https://gltf-transform.dev/) | Inspecionar, transformar e comprimir modelos e texturas | Open-source; confirmar a licença da versão fixada |
| Textura GPU-compressed | [KTX-Software / Basis Universal](https://github.com/KhronosGroup/KTX-Software) | Produzir KTX2/Basis para reduzir memória e largura de banda | Conferir a licença da release e dos componentes |
| Engine alternativa para protótipos | [Godot](https://godotengine.org/) | Provas isoladas de mecânicas 2D/3D, sem substituir o runtime atual | MIT; não adicionar ao bundle Web atual |
| Runtime e renderização | [Three.js](https://threejs.org/) | Renderização WebGL, GLTFLoader, instancing e perfis adaptativos | MIT; versão fixada no projeto |

## Fluxo de produção de arte

1. Criar conceito original; usar referências técnicas sem copiar personagens, mapas, interfaces ou assets protegidos.
2. Modelar no Blender com escala, pivô, nomes e orientação padronizados.
3. Fazer UVs e materiais PBR; evitar materiais únicos desnecessários.
4. Criar LODs e reduzir polígonos com gltfpack/meshoptimizer.
5. Validar o GLB com o Khronos glTF Validator.
6. Converter texturas para KTX2/Basis somente após comparar qualidade visual, compatibilidade e memória no Android. Manter fallback compatível.
7. Registrar o asset em `assets/3d/manifest.json` com `enabled: true` somente depois de aprovado.
8. Rodar `npm run assets:validate`, testes, inspeção visual e teste em aparelho real antes de publicar.

## Orçamento e proteção automatizada

O verificador `scripts/validate-3d-assets.js` não baixa arquivos nem executa conteúdo externo. Ele valida versão do manifesto, até 32 modelos, tipos suportados, ausência de duplicatas, caminhos locais sem traversal, assinatura/versão/tamanho declarado do GLB 2.0 e limites de 12 MiB por modelo e 48 MiB somados para modelos habilitados. É uma primeira barreira: não substitui o Khronos Validator, testes de renderização ou medições em aparelhos reais.

## Licenciamento e proveniência dos assets

Antes de incluir qualquer arquivo no jogo, registrar caminho, autor, URL de origem, licença exata, comprovante/data de obtenção, atribuição exigida e modificações. Preferir arte original, CC0 ou licenças comerciais claras. Não usar assets com cláusula NonCommercial (NC), licenças desconhecidas ou redistribuição proibida. Fontes, áudio, plugins e modelos têm licenças independentes.

## Medição antes de otimizar

Comparar a mesma cena e aparelho antes/depois: tamanho de download, tempo de carregamento, memória GPU aproximada, draw calls, triângulos, estabilidade de frame time, aquecimento e bateria. Não prometer FPS sem medição em Android físico. Preservar o fallback 2D e os perfis low/balanced/high existentes.
