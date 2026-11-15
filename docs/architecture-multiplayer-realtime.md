# Arquitetura multiplayer em tempo real — Clash of Izzy

## Objetivo

Adicionar presença, chat em tempo real, notificações de aliança e coordenação de batalhas sem transformar um único Worker ou Durable Object em gargalo global.

## Separação de responsabilidades

- **Workers:** autenticação, autorização, validação de payloads, rate limits, roteamento e APIs HTTP.
- **D1:** estado persistente de jogadores, reinos, inventário, recursos, marchas, relatórios e histórico econômico.
- **Durable Objects (DO):** coordenação de conexões e estado efêmero/fortemente consistente de uma sala, aliança, evento ou batalha em tempo real.
- **WebSocket Hibernation:** manter conexões sem manter o objeto continuamente em memória; anexos serializados guardam apenas identidade mínima e sala.

Não colocar todos os jogadores em um único DO. Usar nomes determinísticos por sala/aliança/partida e, quando necessário, um DO pai para localizar DOs filhos de partidas ou regiões.

## Fluxo recomendado

1. Cliente abre `/api/realtime/connect` com token de sessão.
2. Worker valida token e consulta a associação/permissão no D1.
3. Worker escolhe o DO da sala e encaminha o upgrade WebSocket com identidade validada em metadados internos.
4. DO aceita a conexão com a API de hibernação e serializa `playerId`, `roomId` e permissões mínimas no attachment.
5. Mensagens recebidas são validadas por tamanho, tipo, versão e rate limit; clientes não decidem resultados de combate nem alteram recursos.
6. Ações econômicas e de combate passam pelo Worker e por transações D1; o DO apenas distribui eventos já aceitos.
7. Eventos lógicos são agrupados em frames, evitando uma mensagem de rede por pequena alteração visual.

## Política de mensagens

- Usar envelope versionado: `{v, type, eventId, payload}`.
- Limitar tamanho de frame e quantidade de mensagens por conexão.
- Ignorar mensagens duplicadas usando `eventId`.
- Enviar snapshots ao entrar na sala; depois, deltas compactos.
- Agrupar aproximadamente 10–100 eventos lógicos por frame ou por janela de 50–100 ms quando a taxa justificar.
- Revalidar permissões no Worker para qualquer ação que mude D1; nunca confiar no cliente ou somente no estado em memória do DO.

## Persistência e consistência

- D1 permanece a fonte de verdade para economia e progressão.
- O DO coordena presença, fan-out, salas e estado temporário de partidas.
- Para uma partida competitiva, um DO por partida pode manter o relógio e a ordem dos comandos; resultados finais são gravados com identificadores idempotentes no D1.
- Usar SQLite-backed Durable Objects para dados transacionais que pertençam à própria sala/partida.
- Hibernação reinicia memória do objeto: restaurar contexto pelos attachments e storage, nunca depender de variáveis globais como fonte de verdade.

## Android e desempenho

O jogo atual é PWA/WebGL. A API Android Thermal/ADPF não fica disponível diretamente ao JavaScript do navegador. A qualidade Web atual deve usar capacidade reportada, orçamento de pixels, draw calls, geometrias, texturas e testes em aparelhos reais. Se o projeto ganhar um invólucro Android nativo, uma ponte nativa poderá consultar Thermal API/ADPF e reduzir FPS, sombras, tesselação e frequência de atualizações sob estresse térmico.

## Critérios antes de ativar em produção

- Testes de autenticação e autorização por sala.
- Testes de reconexão após hibernação e atualização de código.
- Testes de duplicidade, desconexão e rajadas de mensagens.
- Testes de carga com várias salas independentes.
- Observabilidade de conexões, mensagens/s, latência, erros e reconexões.
- Migração DO com nome de classe e tag estáveis; validar preview isolado antes de alterar produção.

## Referências oficiais

- Cloudflare WebSockets e Hibernation: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Regras de arquitetura Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Android Dynamic Performance Framework: https://developer.android.com/games/optimize/adpf
- Android Thermal API: https://developer.android.com/games/optimize/adpf/thermal
