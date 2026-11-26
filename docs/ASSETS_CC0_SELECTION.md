# Seleção de assets CC0 para Eldoria
Pesquisa de fontes originais: 25/11/2026. A seleção é de candidatos; não declara que novos modelos foram baixados, integrados ou homologados.

| Uso | Fonte | Situação |
|---|---|---|
| Torres, muralhas e cerco | https://kenney.nl/assets/castle-kit | Já existem 3 GLBs locais; preservar |
| Árvores e arqueiro | https://kenney.nl/assets/mini-forest | Já existem 2 GLBs locais; preservar |
| Edifícios de estratégia e evolução | https://quaternius.com/packs/ultimatefantasyrts.html | CC0 declarado; selecionar e testar edifícios distintos |
| Aldeia e fazendas | https://quaternius.com/packs/medievalvillage.html | CC0 declarado; candidato |
| Personagens e animações | https://quaternius.com/packs/ultimatedanimatedcharacter | CC0 declarado; candidato |
| Dragão 3D | https://opengameart.org/content/cethiels-dragon-3d | CC0 declarado; verificar arquivo, rig e clips |
| Equipamentos e adereços | https://quaternius.com/packs/fantasypropsmegakit.html | CC0 declarado; apenas arquivos efetivamente gratuitos e licenciados |
| Madeira | https://polyhaven.com/a/medieval_wood | CC0; candidato PBR |
| Pedra | https://polyhaven.com/a/medieval_blocks_03 | CC0; candidato PBR |
| Caminhos | https://polyhaven.com/a/cobblestone_floor_001 | CC0; candidato PBR |
| Interface | https://kenney.nl/assets/ui-pack-rpg-expansion | CC0; candidato |
| Efeitos sonoros | https://kenney.nl/assets/rpg-audio | CC0; candidato |
| Música de guerra | https://opengameart.org/content/eye-of-the-storm-0 | CC0 declarado; candidato |

Licença de texturas Poly Haven: https://polyhaven.com/license. Usar apenas arquivos de asset autorizados, não imagens de demonstração, logos ou renders do site. Respeitar termos do fornecedor. Nenhuma compra de pacote premium autorizada.

## Critérios de importação
- Obter arquivo de fonte original e cópia da licença; registrar hash e versão. Não aceitar origem desconhecida nem copiar Clash of Kings.
- Mapear cada modelo a um tipo existente de edifício/unidade/prop; preservar fallback procedural, escala, pivô e coordenadas; não mudar regras de economia ou combate.
- Evitar arquivos com mesmo hash e materiais duplicados. Não importar pacotes inteiros indiscriminadamente.
- Limitar texturas iniciais a 512/1024 pixels conforme perfil, medir draw calls, memória e tamanho; manter texturas locais e GLB 2.0.
- Validar clips de animação de dragões (idle, voo, ataque quando existentes), tropas (idle, marcha, ataque), sem criar nomes de clips inexistentes. Respeitar reduced motion.
- Homologar a mudança visual em Chromium e Android físico antes de substituir a apresentação em produção.
- O manifesto atual possui somente cinco GLBs Kenney. Heróis, skins, dragões e demais edifícios continuam pendentes de importação e homologação artística. Nenhuma promessa de equivalência visual com jogos de terceiros.
