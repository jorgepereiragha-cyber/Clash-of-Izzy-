# Fontes online verificadas — Eldoria
Pesquisa 2026-11-25. Não confundir disponibilidade gratuita com aprovação comercial ou qualidade final.
- 3DAssets.dev: https://3dassets.dev/packs/medieval-rts-faction-buildings (CC0; 74 modelos anunciados, low-poly). https://3dassets.dev/packs/medieval-castle-construction (CC0; componentes de fortificação). Usar peças individuais e rever silhueta/paleta; não importar a cena inteira.
- Quaternius: https://quaternius.com/packs/medievalvillagemegakit.html (CC0; componentes modulares).
- Polyfork: https://polyfork.dev/licensing (atribuição CC BY 4.0 conforme item; conferir restrições).
- Open Source 3D Assets: https://github.com/toxsam/open-source-3D-assets (registro CC0; revisar item).
- Meshy: https://help.meshy.ai/en/articles/15696428-what-is-included-on-the-free-plan (CC BY 4.0 no plano grátis; creditar).
- Forge: https://three.ws/forge (uso comercial e cotas a confirmar, não aprovado).
- Krea: https://www.krea.ai/apps/ai-3d-model-generator (licença comercial anunciada em planos pagos; não assumir direito no grátis).
- Needle: https://castle.needle.tools/ (referência/protótipo; verificar licença de cada modelo).
- Three.js Editor: https://threejs.org/editor/ (montar referência de iluminação, câmera e escala; exportar GLB por prédio).
## Procedimento
A lista online_candidates.json identifica 11 modelos candidatos, não arte final. Baixar via fetch_online_candidates.py em diretório novo fora de assets; a ação de CI guarda artefato temporário e SHA-256, sem escrita no repo, secrets, deploy ou ativação.
O script verifica URL fixa HTTPS sem redirecionamentos, orçamento, cabeçalho e geometria. É triagem, não substitui Khronos glTF Validator nem inspeção no Three.js. Após aprovação humana, copiar GLB e proveniência para pasta local e registrar no manifesto runtime. Preservar IDs e dimensões do servidor, skins e fallback. O castelo não será substituído por um conjunto de peças avulsas; precisa de composição artística e homologação de cada estágio. Os candidatos low-poly não demonstram acabamento comparável ao objetivo final.
Nenhum scene.json de terceiros deve substituir estado D1, posição dos edifícios, hit targets ou loop do motor. ObjectLoader serve apenas para composição controlada/preview.

## Resultado da triagem de 25/11/2026
Run 45726016000: 11 arquivos, 384404 bytes de GLB, 11 hashes SHA-256 conferidos após download do ZIP. Todos declaram KHR_mesh_quantization; nenhum contém imagens de textura. Fazenda 3548 triângulos e 2 animações; outros dez 200–780 triângulos. Não confundir cores PBR escalares com texturas PBR detalhadas. Manter como candidatos, não substituir arte procedural sem render comparativo. O validador agora verifica contagens de atributos por primitiva e registra imagens e materiais. O castelo procedural passa a ter cinco estágios (1/10/20/25/30), com evolução de torres e fachada; texturas procedurais de pedra e telha recebem ajuste de juntas e contraste sem novos downloads.
