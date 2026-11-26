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

## Modelos cívicos KayKit

Origem oficial: https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0/tree/84fa4e91af6a88989be7c99e0891cede11f2ca38. Licença CC0 preservada localmente. Quartel, mercado e mina de ferro azuis convertidos de glTF + BIN para GLB 2.0 sem alterar malhas ou materiais, usando uma textura PNG original compartilhada. Manifesto existente, carregamento por tipo e fallback procedural preservados. Castelo, skins e VIP não alterados. Os modelos são estáticos; escala, orientação e base hexagonal ainda exigem inspeção Android.

Candidatos de retratos, sem importação: https://foozlecc.itch.io/legends-fantasy-portraits-human-barbarians, https://torpilstudio.itch.io/fantasy-character-portraits, https://oicaroh.itch.io/medieval-fantasy-character-portraits. Confirmar licença de cada pacote, inspecionar arte, selecionar por identidade e converter para WebP local. Não substituir retratos únicos por imagens genéricas repetidas; arte pública não é exclusiva. Estilo não limitado ao medieval.

Correção após CI: a mina KayKit permanece armazenada, mas desabilitada no manifesto. A arquitetura rural original, com progressão por nível, continua ativa. O teste integrado do reino exige essa preservação. Quartel e mercado continuam candidatos ativos.

## Controle de conformidade e integridade
O manifesto v2 existente é a fonte única: a seção `files` registra cada arquivo de arte local (incluindo texturas e modelos desabilitados), origem, licença, crédito, evidência local, tamanho e SHA-256. Os hashes iniciais foram calculados sobre os blobs da beta 81caf85c83fd5a7a2e4fffe74454f79f576fae8a. O histórico original de download não foi inferido. A verificação `npm run assets:validate` inclui auditoria de arquivos não registrados, hashes e licenças, além da validação GLB. O reino ignora entradas não aprovadas e mantém o fallback. A auditoria de hashes é de build, não uma garantia criptográfica do cliente.
 
Fontes candidatas (não importadas): Quaternius Medieval Village MegaKit e Ultimate Fantasy RTS (CC0), Poly Haven e ambientCG (CC0). Usar somente os arquivos realmente gratuitos; verificar termos da API Poly Haven, incluindo User-Agent identificável. Mixamo fica fora de aprovação automática até revisão da distribuição web dos arquivos e licença; CC-BY-SA, NC, GPL, AGPL, arquivos sem origem e rips também ficam bloqueados. A aprovação de novos arquivos exige revisão de autoria e licença, não apenas hash. Antes de aprovar CC-BY, publicar crédito individual com autor, título, link da obra, licença e alterações. O limite de modelos de tropas do renderer passa de 8 para 16, sem elevar os limites de instâncias. Não habilitar modelos novos sem inspeção Android, orçamento por cena e validação glTF. Os modelos atuais Kenney permanecem fallback/provisórios.
