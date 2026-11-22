# Auditoria de identidade dos heróis — Clash of Izzy

Auditoria do catálogo canônico de `hero-catalog.js` e do atlas `assets/art/heroes/portraits.svg`.

**Resultado:** 18 heróis recrutáveis com 18 retratos distintos e 5 personagens sazonais com 5 retratos próprios. Cada uma das 23 chaves possui uma ficha narrativa, afiliação, lema e aura única em `hero-identities.js`. Nomes, títulos e histórias são apresentados nas cartas dos heróis.

Atenção: retratos vetoriais distintos não equivalem a 23 personagens 3D originais. Os 5 heróis do panteão egípcio e os 4 deuses nórdicos continuam sendo *releituras de figuras mitológicas*, não nomes exclusivos do jogo. A atribuição histórica e cultural pode ser mantida, mas artes e código de terceiros não podem ser copiados.

**Renomeações sem alterar `hero_key`:**

| Antigo nome | Identidade de Eldoria |
|---|---|
| Soldado Recruta | Darian Ferrovale — Sentinela do Primeiro Muro |
| Arqueiro da Floresta | Lyria Falcobruma — Batedora de Folhavento |
| Cavaleiro Novato | Torven Galopardo — Escudeiro da Aurora |
| Curandeiro da Aldeia | Elara Ervalume — Curadora do Vale Azul |
| Capitão da Guarda | Rovan Brasaferro — Capitão do Bastião |
| Mestre Arqueiro | Serin Longavento — Olho do Carvalho |
| Cavaleiro do Dragão | Veyron Escamaforte — Guardião da Brasa Alta |
| Sacerdotisa do Luar | Maelis Pratalua — Oráculo das Marés |
| Rei Artur | Arthelion de Aurendal — Soberano das Sete Lâminas |
| Merlin | Meridran Astrolume — Arquiteto dos Arcanos |
| Joana D’Arc | Serah Valen — Sentinela da Chama Viva |
| Genghis Khan | Kharzun Ventobravo — Senhor das Mil Selas |

Os nomes egípcios, Kael e os nomes sazonais persistidos em D1 foram preservados, pois identificam uma linha temática. A identidade visual própria é formada pelas artes originais, auras, história e universo narrativo de Eldoria.

**Validação de lançamento:** revisar visualmente cada retrato no Android, verificar performance em celulares reais, confirmar direitos de uso das artes e validar acessibilidade sem animação. As auras são CSS sem pós-processamento gráfico novo.
