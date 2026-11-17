# Realtime de Eldoria — fase inicial

## Arquitetura

- O Cloudflare Worker continua sendo a API autoritativa e a entrada HTTP do jogo.
- D1 continua sendo a fonte persistente de jogadores, reinos, economia, filas e combate.
- O Durable Object `EldoriaRoom` fornece uma sala WebSocket compartilhada chamada `eldoria`.
- Esta primeira fase valida conexão, heartbeat e presença (quantidade de conexões). Não altera recursos, tropas, construções, pagamentos ou dados D1.
- Nenhum processo Node.js da Discloud é necessário para esta arquitetura. As variáveis globais da Discloud não são lidas pelo Worker e não devem ser copiadas para o GitHub.

## Endpoint

`GET /api/realtime/eldoria` com `Upgrade: websocket` e o Bearer token de jogo já existente (`coi_game_token`).

O Worker valida a sessão com `gameIdentity()` antes de encaminhar a conexão ao Durable Object. O identificador do jogador é encaminhado apenas no salto interno Worker → Durable Object. A sala não expõe IDs de jogadores.

Mensagens aceitas do cliente nesta fase:
- `{"type":"ping"}` → resposta `{"type":"pong"}`.
- Qualquer outro tipo recebe erro `unsupported_message`; clientes não podem alterar estado do jogo nem publicar mensagens arbitrárias.

Eventos enviados pelo servidor:
- `connected`: confirmação da sala.
- `presence`: número de conexões WebSocket ativas.

Limite defensivo inicial: 200 conexões simultâneas na sala. Esse valor é um limite de segurança de implementação, não uma estimativa de capacidade comercial.

## Ativação

O binding e a classe são declarados em `wrangler.jsonc`. A criação da classe é uma migração de infraestrutura do Worker (não uma migração D1). O namespace só passa a existir quando uma implantação com essa configuração é concluída.

Antes de promover para produção:
1. executar `npm test`;
2. executar `npm run check`;
3. fazer deploy por workflow protegido;
4. testar handshake WebSocket autenticado, heartbeat, desconexão e presença em dois dispositivos;
5. observar métricas e cotas antes de liberar a conexão no frontend.

## Limitações

Esta fase não transforma o jogo inteiro em simulação contínua. Construções, marchas, economia e batalhas continuam no Worker + D1, com as validações atuais. A sala realtime é uma base de transporte; sincronização de eventos de gameplay e chat global exigem implementação e testes próprios.
