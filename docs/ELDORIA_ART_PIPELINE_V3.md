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

## Staging Blender
Utilize docs/art-pipeline/prepare_static_lods.py em Blender headless com arquivo GLB estático licenciado e três budgets. Exporta três GLBs separados sem sobrescrever, centraliza no chão, verifica triângulos e recusa rig/animação. Exemplo: `blender -b --python-exit-code 1 --python docs/art-pipeline/prepare_static_lods.py -- source.glb /tmp/eldoria/farm_L1 --budgets 8000 2500 800`. Validação de sintaxe no CI; execução real Blender, retopologia, UV, Draco e KTX2 ainda exigem homologação. Nunca usar o decimador estático para dragões ou tropas animadas.

## Pacote final de automação (adaptado ao projeto)
- `python3 docs/art-pipeline/plan_generation.py all` lista os 76 modelos previstos sem rede ou cobrança. Use grupos castle/economy/military/special/dragons/troops e --limit 1 para piloto. Ainda não envia jobs. Meshy exige preview e refine para textura; validar shape antes do refine. Tripo exige contrato e credenciais próprios. Revisar preços/licença antes de autorização de gastos; jamais salvar tokens no Git.
- `python3 docs/art-pipeline/validate_staging_glb.py file.glb --max-triangles 8000` verifica cabeçalho, geometria e tamanho; --require-ktx2 verifica declaração de extensão, não substitui validador glTF completo nem inspeção visual.
- Receitas PBR: docs/art-pipeline/MATERIAL_RECIPES.md.
- Projeto real: JavaScript ES modules, Three.js, Node test, Worker/D1; sem Vite/TypeScript/Vitest. Não importar CityState/UpgradeFlow paralelos ou criar placeholders binários fictícios. O fallback procedural existente é mantido.
- Pipeline operacional requer modelos reais, Blender e aprovação de arte; não chamar staging de release. Não registrar arte sem licença. Referência Meshy: https://docs.meshy.ai/en/api/text-to-3d .

## Acabamento procedural adicional
- Telhados de duas águas originais, com faces UV e materiais de telha/alvenaria separados, no celeiro e edifícios cívicos. A orientação acompanha o eixo maior. Torres e muralhas mantêm o desenho específico.
- Janela lateral e acabamento de pedra visíveis na câmera isométrica em Balanced/High, sem luz pontual adicional. Economia não recebe as três malhas extras.
- Tijolos e telhas nos limites horizontais recebem cor determinística por célula periódica; não se introduz uma segunda biblioteca de texturas.
- Referências de materiais: https://threejs.org/manual/pages/color-management.html ; https://polyhaven.com/license ; https://docs.ambientcg.com/license/ . Nenhum arquivo de textura de terceiros foi incorporado nesta revisão.
- Ainda requer screenshot comparativo e teste físico Android; não é certificação artística ou de FPS.
