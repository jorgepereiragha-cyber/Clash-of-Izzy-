# Direção visual de Eldoria — primeira integração

Castelo original procedural com torreão central habitável, portão, torres redondas, fundações, janelas, bandeiras e quatro estágios de evolução (1, 10, 20, 30). Usa paletas de skins existentes. Quinze edifícios não centrais recebem volumes específicos; modelos GLB licenciados continuam disponíveis apenas para seus tipos. Rótulos 3D preservam áreas de toque de 44px com fundo menos opaco. Sem alterar coordenadas, níveis, economia, inventário, D1, APIs ou regras.

Esta é uma etapa arquitetônica, não uma coleção de modelos comerciais de alta fidelidade. Ainda faltam arte 3D autoral detalhada, UVs e texturas produzidas por artista, terreno urbano, muralhas contínuas, mapas, personagens, animações e reavaliação do fallback 2D. CI deve produzir evidência de renderização real; teste de desempenho em Android físico permanece obrigatório. Referências técnicas: https://threejs.org/docs/ e https://kenney.nl/assets/castle-kit. Nenhum recurso proprietário de Clash of Kings foi importado.

## Configurações gráficas e estabilidade

A cidade e o mapa compartilham a seleção de qualidade por memória, núcleos, economia de dados e limite real de texturas da GPU. O mapa mantém seu orçamento próprio de pixels. Acesso negado ao armazenamento local não impede o carregamento da cidade; preferências não gravadas são informadas ao jogador. As marchas não recalculam rótulos estáticos a cada frame: atualização por estado, câmera ou tamanho continua ativa. Nenhuma alteração de coordenada persistida, sessão, combate ou economia. Referências: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage e https://threejs.org/docs/#api/en/renderers/WebGLRenderer .
