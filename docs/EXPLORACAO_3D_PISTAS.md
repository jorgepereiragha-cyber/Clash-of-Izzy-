# Exploração 3D e pistas do mundo — Clash of Izzy

Status: arquitetura e critérios definidos; mapa mundial 3D com pistas ainda não implementado.
Branch de referência: `feature/offline-kingdom-progression`.

## Auditoria do que existe hoje

- O Centro de Comando apresenta territórios em cartões HTML por meio de `renderWorld()`; não é uma cena 3D navegável.
- O repositório contém uma arena 3D separada, mas não foi encontrado um renderer Three.js de mapa mundial ligado ao Arquivo Velado.
- A campanha A Primeira Fenda e as três pistas do Arquivo Velado agora têm progresso persistido no D1 por reino.
- A tabela `kingdom_story_progress` registra apenas campanhas e etapas concluídas. Ela não armazena coordenadas ou posições 3D.
- Não criar um segundo sistema de progresso ou outra fila. O servidor atual e a tabela nova são a fonte de verdade para as descobertas.

## Arquitetura recomendada

1. **Manifesto de locais:** definir IDs estáveis para cada ruína, inscrição, lente, estrela e entrada de galeria. O manifesto visual pode manter posição e metadados de apresentação, mas nunca decide se o jogador concluiu uma descoberta.
2. **Cena 3D:** carregar os modelos medievais em glTF 2.0 usando `GLTFLoader`. Separar o carregamento por áreas e evitar carregar o mundo inteiro no primeiro acesso.
3. **Interação:** associar a cada objeto interativo um `storyNodeId` em `Object3D.userData`. Usar `Raycaster` para identificar o objeto tocado e abrir um painel de descoberta. O painel HTML deve continuar disponível como alternativa acessível.
4. **Autoridade:** ao confirmar uma pista, enviar apenas `campaign` e `step` para `/api/game/action`. O Worker valida sessão, reino, Castelo, catálogo e pré-requisito; D1 registra a descoberta com chave primária única. Posição, horário, recompensa ou estado enviados pelo cliente nunca são aceitos como prova.
5. **Sincronização:** ao entrar no mapa, usar `storyProgress` retornado por `/api/game/state` para mostrar pistas já descobertas em qualquer dispositivo. A cena pode exibir efeitos e ícones, mas não cria progresso offline local.
6. **Fallback:** em telas pequenas, baixa potência ou falha WebGL, manter a lista textual do Arquivo Velado. O jogador não pode perder acesso à história por incompatibilidade gráfica.

## Desempenho para Android

- Preferir modelos glTF otimizados; avaliar Draco ou Meshopt para geometria e KTX2/Basis para texturas quando o pipeline estiver configurado.
- Carregar somente a região visível e liberar geometria, materiais e texturas ao descarregar uma área.
- Usar instanciamento para rochas, árvores, tochas e objetos repetidos; LOD e frustum culling para cenários maiores.
- Fazer raycast somente nos objetos interativos, usando bounding volumes e camadas de interação em vez de testar todos os triângulos da cena a cada frame.
- Medir draw calls, triângulos, memória de textura e FPS em aparelhos Android modestos antes de fixar metas de qualidade.
- Oferecer qualidade gráfica adaptativa e opção de reduzir efeitos; não tornar a descoberta dependente de reflexos, partículas ou efeitos caros.

## Primeira rota de exploração proposta

- **Cripta das fundações:** a lente azulada revela um desenho de túneis. ID do servidor: `veil_archive/lens`.
- **Observatório abandonado:** sete estrelas de prata; a estrela deslocada indica a torre apagada. ID: `veil_archive/star`, após a lente.
- **Sala dos mapas:** livro sem autor, com as páginas finais em branco. ID: `veil_archive/ledger`, após a estrela.
- **Galerias sob a torre:** vestígio do Basilisco depois dos três capítulos de A Primeira Fenda. ID: `first_rift/basilisk`.

As posições físicas desses locais ainda precisam ser definidas no layout do mapa; não inventar coordenadas antes de existir uma cena mundial real.

## Segurança e testes de aceite

- Usuário não autenticado recebe 401; campanha ou etapa desconhecida é rejeitada.
- Castelo abaixo do requisito não conclui a campanha.
- Uma etapa sem o pré-requisito anterior retorna conflito.
- Repetir a mesma requisição não duplica o registro nem cria eventos duplicados.
- Dois dispositivos mostram o mesmo progresso após sincronização.
- Alterar localStorage, relógio do telefone ou coordenadas não desbloqueia conteúdo.
- Falha WebGL oferece alternativa HTML.
- Testar toque, arrasto de câmera, zoom, rotação e alvos pequenos em diferentes densidades de tela.
- Nenhuma recompensa econômica ou vantagem competitiva é concedida nesta primeira versão.

## Referências técnicas e de design

- Cloudflare Workers Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare D1 FAQ e limites de concorrência: https://developers.cloudflare.com/d1/reference/faq/
- Cloudflare D1 batch e transações: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Three.js Raycaster: https://threejs.org/docs/pages/Raycaster
- Three.js Picking: https://threejs.org/manual/pages/picking.html
- Three.js GLTFLoader: https://threejs.org/docs/pages/GLTFLoader.html
- Pesquisa CHI 2025 sobre como jogadores interpretam storytelling ambiental: https://doi.org/10.1145/3706598.3714036

## Próxima entrega

Depois de estabilizar a migração 0010 e aprovar os testes do Worker, implementar uma única área pequena da cena mundial: a Cripta das Fundações, um objeto clicável, painel acessível e confirmação pelo endpoint existente. Só então expandir para observatório, sala dos mapas e galerias.
