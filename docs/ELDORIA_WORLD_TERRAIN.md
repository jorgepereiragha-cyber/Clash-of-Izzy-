# Eldoria — terreno visual incremental

- Continuidade de cores por vértice, margens de rio e agrupamentos determinísticos de árvores no renderer existente.
- Rio com duas faixas de geometria seguindo o relevo em vez de um tubo de altura fixa encoberto pelo chão; preserva posições e tempo de marcha.
- Sem texturas remotas nem aumento da quantidade máxima de árvores. Material do terreno entra no descarte existente.
- Testes de determinismo, limites e geometria no workflow de visuais da beta.
- Referência técnica: https://threejs.org/docs/pages/BufferGeometry.html e https://threejs.org/docs/pages/InstancedMesh.html.
- Texturas CC0 candidatas (não baixadas/incorporadas): https://polyhaven.com/a/aerial_grass_rock e https://polyhaven.com/a/aerial_ground_rock. Necessária homologação de tamanho, licença, resolução e desempenho antes de incorporar.
- Ainda faltam pontes com geometria própria, terreno texturizado, névoa de guerra baseada em autorização do servidor e medição física de FPS. Não altera regras, banco, pagamentos, mapa 2D nem deploy.
