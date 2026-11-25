# Eldoria: pipeline visual profissional (proposta implementada parcialmente)
O catálogo de produção em docs/eldoria-art-catalog.json não é manifesto runtime e não habilita arquivos ausentes.
Preservar D1, APIs, grid, níveis, skins, fallback 2D e orçamento de GPU. Nenhum asset final foi gerado.
O seletor aceita minLevel e lod (0/1/2), carrega apenas uma variante por edifício visível; o fallback procedural permanece em falha. Perfis low/balanced/high escolhem LOD por qualidade, não distância. Castelo com skin ativa continua procedural até existir material compatível. Não incorporar ornamentos do runtime na malha base sem revisar duplicação.
Os tiers 1/5/10 das estruturas comuns são propostas artísticas, não limites de progressão. Estruturas especiais, dragões, retratos WebP e animações finais necessitam integração futura. O limite global de 48 MiB continua em vigor; não aumentar sem medir rede/GPU.
## Produção
1. Gerar referências próprias e modelos base em Blender/Meshy/Tripo/Rodin; registrar origem, licença e autorização comercial. Nunca importar recursos de jogos alheios.
2. Verificar topologia, UV, materiais, triângulos e pivô; usar Blender para variantes separadas por LOD, Y-up no glTF. Não decimar personagens rigados automaticamente sem validar pesos.
3. Exportar GLB 2.0, testar Draco/Meshopt e KTX2 com GLTFLoader e detectSupport. KTX2 deve estar referenciado no glTF pela extensão correta; copiar arquivos soltos não basta. Albedo sRGB, normal/ORM linear, mipmaps. Evitar luzes e partículas embutidas.
4. Testar cada arquivo com validador e screenshots de cidade/zoom e perdas de contexto; ativar no manifesto apenas arquivo existente e aprovado. Manter procedural em falhas. Modelos separados por LOD para não baixar todos simultaneamente.
5. Android: medir frame time, GPU/CPU, memória, aquecimento em dispositivo real; metas 30 FPS entrada, 60 FPS intermediário e 220 MB GPU não comprovadas. Não liberar produção sem testes.
## Referências
https://threejs.org/docs/pages/GLTFLoader.html
https://threejs.org/docs/pages/KTX2Loader.html
https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
https://developer.android.com/games/optimize/gameperformance
