# Eldoria — receitas de materiais PBR
Propostas de acabamento, não arquivos Smart Material nem texturas geradas.
Usar normal OpenGL, baseColor sRGB, roughness/metallic/AO lineares; ORM R=AO G=roughness B=metallic.
Evitar AO forte duplicado no albedo e na iluminação. Musgo por máscara de orientação world-space e umidade; curvatura por bordas.
| Família | Base | Roughness | Metal | Camadas |
|---|---|---|---|---|
| Pedra | #8C7B5E | .82 | 0 | blocos, desgaste, sujeira, musgo |
| Ardósia | #3B424D | .55-.75 | 0 | telhas, escorrimento, variação |
| Carvalho | #6B4A2A | .78 | 0 | veios, desgaste, sujeira; pregos separados |
| Ferro | #2A2D33 | .40 | 1 | riscos, ferrugem não metálica, bordas |
| Ouro | #D4A62B | .28 | 1 | pátina leve, bordas |
| Tecido | #8B1E1E | .90 | 0 | trama, emblema original, desgaste |
| Piso | #7A6440 | .88 | 0 | juntas, pedras, umidade |
| Vegetação | #4A6B3A | .95 | 0 | variação, terra, tufos |
Exportar 2048 castelo, 1024 edifícios/dragões, 512 props/tropas como ponto de partida. Validar UV, mipmaps, normal e transparência. KTX2 ETC1S para cor e ORM se qualidade aceitável; UASTC para normal. Usar exportador glTF compatível com KHR_texture_basisu e validar resultado no Three.js. Não substituir imagens PNG manualmente sem corrigir referências e metadados.
