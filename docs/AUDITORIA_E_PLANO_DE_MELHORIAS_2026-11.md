# Auditoria e plano de melhorias — Clash of Izzy
Data: 14/11/2026
Branch de trabalho: research/improvements-2026-11
Base auditada: main, commit b8125b00f64a33b9d7e906c55ed7262eca69e1e1

## Objetivo preservado
Construir um jogo de estratégia medieval 3D para Android/Web, com reino persistente, mapa mundial, heróis, dragões, tropas, pesquisa, alianças, guerras, eventos, loja cosmética e multiplayer. O protótipo existente é a base; não reiniciar nem apagar arquivos ou migrações já aplicadas.

## O que já existe na base principal
- Front-end Web com Three.js e arena jogável.
- Cloudflare Worker como API e Cloudflare D1 como persistência.
- Migrações SQL para jogadores, reinos, edifícios, tropas, heróis, pesquisa, dragões, mapa, marchas, relatórios de batalha, economia, alianças, chat e guerras.
- Simulador de combate no servidor e testes unitários básicos.
- PWA (manifesto e service worker), fluxo de CI e workflow de publicação.
- Loja, mercador rotativo, inventário cosmético, coleções, fusões e itens sazonais.

O repositório secundário `-clash-of-izzy-mod.` contém somente um README mínimo; não é uma base de desenvolvimento. Manter sem alterações por enquanto.

## Achados prioritários da auditoria

### P0 — Segurança e integridade econômica
1. **CORS amplo:** `worker.js` define `Access-Control-Allow-Origin: *` e permite `Authorization`. Como a API usa tokens Bearer, a política deve ser reduzida ao(s) domínio(s) oficial(is) do jogo ou removida para chamadas same-origin. Antes de alterar, confirmar os domínios efetivamente usados (produção, preview e app).
2. **Compras em múltiplas etapas:** em `shop_buy` e `seasonal_buy`, o débito da moeda ocorre antes do lote que entrega os itens. Se a etapa posterior falhar, pode haver cobrança sem entrega. Refatorar para uma operação atômica, com validação de saldo, estoque, concessão e recibo/idempotência no mesmo fluxo transacional.
3. **Resgate concorrente de coleções:** `cosmetic_claim` verifica o resgate, credita gemas e só depois grava a reivindicação. Duas requisições simultâneas podem tentar resgatar a mesma recompensa. Implementar reivindicação única e crédito condicionado à primeira inserção, de forma atômica.
4. **Limites de abuso:** não foi localizada proteção explícita de rate limit por jogador/IP nos caminhos pesquisados. Acrescentar limites para login/criação de reino, invocação de herói, chat, compras, convites e ações repetidas; registrar tentativas suspeitas sem expor dados pessoais.

### P1 — Justiça, design e retenção
5. **Cosméticos com atributos:** as definições de skins comuns, raras, épicas, lendárias, sazonais e fundidas incluem ataque/defesa e bônus de combate/economia. Isso transforma cosméticos em vantagem competitiva paga. Separar rigorosamente aparência de poder: skins devem ser visuais; atributos devem vir de progressão jogável, heróis, dragões, equipamento e pesquisa com limites de balanceamento.
6. **Economia da loja:** o seed inicial inclui skins de R$ 50 a R$ 1.000 e pacotes VIP até R$ 1.000. Não publicar esses valores como preços definitivos. Fazer teste de disposição a pagar, comparar preços regionais, oferecer itens cosméticos acessíveis, passe opcional e recompensas equivalentes por jogo gratuito. Não vender poder exclusivo nem criar pressão artificial.
7. **Heróis originais:** revisar o catálogo de heróis do Worker; há referências a figuras históricas e personagens de mitologia/fantasia conhecidos. Substituir por personagens próprios do universo Clash of Izzy, com nomes, silhuetas, biografias e habilidades originais.

### P1 — Multiplayer e operações ao vivo
8. **Tempo real:** o Worker expõe API HTTP e o chat de aliança é persistido em D1; não foi localizado um fluxo WebSocket/Durable Object no código auditado. Para chat instantâneo, presença, notificações e coordenação de guerra, avaliar Durable Objects por sala/aliança, mantendo Worker para autenticação e validação. Não colocar o mundo inteiro em um único objeto.
9. **Autoridade do servidor:** manter saldo, inventário, recompensas, resultados de batalha, marchas e posse de territórios exclusivamente no servidor. O cliente deve enviar intenções, nunca resultados finais. Adicionar sequência/idempotência nas ações e trilha de auditoria.
10. **Eventos e LiveOps:** criar calendário versionado de eventos, configuração remota validada, metas individuais e de aliança, placares com regras transparentes, recompensas gratuitas e repetição semanal. Eventos devem ter início/fim definidos pelo servidor e proteção contra resgate duplicado.

### P2 — Desempenho, escala e qualidade
11. **Mapa mundial:** não carregar o mundo inteiro para todos os jogadores à medida que o mapa crescer. Usar paginação/consulta por região visível, índices espaciais simples e payloads compactos.
12. **Three.js móvel:** manter resolução interna limitada por orçamento de pixels, instancing para objetos repetidos, LOD por distância, carregamento progressivo e redução de efeitos em aparelhos modestos. Medir FPS, memória, tempo de carregamento e consumo de bateria em aparelhos reais.
13. **Testes:** ampliar cobertura para economia, compras, concorrência, autenticação, permissões de aliança, marchas e combate. Adicionar testes de migração local e cenários de carga antes de qualquer publicação.
14. **Migrações:** preservar todos os arquivos de migração existentes, mesmo com prefixos repetidos (0002 e 0004). Não renomear migrações aplicadas. A próxima migração nova deve seguir a sequência acordada e ser aditiva, testada em D1 local antes de produção.

## Sequência recomendada de execução
1. Confirmar domínio oficial e revisar CORS, autenticação, rate limits e cabeçalhos.
2. Corrigir atomicidade/idempotência de compras e recompensas; criar testes de concorrência.
3. Remover poder das skins e redesenhar progressão/loja para monetização justa.
4. Completar auditoria do Worker e de permissões/ações de alianças.
5. Projetar chat/presença em Durable Objects por aliança ou sala, sem migrar todo o backend de uma vez.
6. Entregar eventos sazonais e recompensas de login com configuração server-side.
7. Otimizar mapa/3D com métricas em dispositivos móveis.

## Critérios de segurança para mudanças
- Trabalhar em branch separada e revisar diff antes de integrar em main.
- Não editar nem reaplicar migrações já usadas em produção.
- Não publicar nem executar migrações remotas nesta etapa.
- Não adicionar segredos, tokens, senhas ou dados pessoais ao repositório.
- Fazer backup e testes locais antes de qualquer mudança de produção.

## Referências técnicas consultadas
- Cloudflare Durable Objects — coordenação stateful, salas multiplayer e WebSockets: https://developers.cloudflare.com/durable-objects/
- Cloudflare — regras e boas práticas de Durable Objects (atualizado em 05/11/2026): https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Cloudflare Workers — opções de armazenamento e quando usar D1/DO: https://developers.cloudflare.com/workers/platform/storage-options/
- Three.js — design responsivo e limite de resolução para evitar custo excessivo de GPU móvel: https://threejs.org/manual/pages/responsive.html
- Heroic Labs — modelos de multiplayer autoritativo: https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/
- Unity Multiplayer — autoridade do servidor e integridade de estado: https://docs-multiplayer.unity3d.com/netcode/current/learn/dealing-with-latency/

## Estado desta entrega
Esta branch registra a auditoria e o plano técnico. Não foram apagados arquivos, não foram alteradas migrações existentes, não houve publicação e nenhuma configuração/segredo de produção foi acessado ou modificado.
