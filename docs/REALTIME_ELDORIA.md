# Realtime de Eldoria — fundação segura

## Arquitetura

- O Cloudflare Worker continua sendo a API autoritativa.
- D1 continua sendo a fonte persistente de jogadores, reinos, economia, filas e combate.
- O Durable Object `EldoriaRoom` fornece uma primeira sala WebSocket compartilhada.
- Nesta fase há conexão, heartbeat e presença agregada. Não altera recursos, tropas, construções, pagamentos ou dados D1.
- A sala usa limite defensivo temporário de 200 conexões. Esse número não é uma meta comercial nem capacidade comprovada.
- Não requer servidor Node/Discloud paralelo; variáveis de outro provedor não devem ser copiadas para o GitHub.

## Autenticação compatível com o navegador

A API WebSocket nativa do navegador não permite definir livremente o cabeçalho HTTP `Authorization`. O cliente não deve tentar enviar diretamente `coi_game_token` no handshake.

Fluxo implementado na branch:
1. Cliente chama `POST /api/realtime/eldoria/ticket` pelo cliente HTTP autenticado já existente, usando Bearer token.
2. Worker valida a sessão usando `gameIdentity()` e aplica rate limit.
3. Worker encaminha uma solicitação interna autenticada por binding ao Durable Object.
4. Durable Object emite ticket aleatório opaco, válido por 30 segundos, persistido no storage SQLite do objeto.
5. Cliente abre WebSocket com os subprotocolos `coi-eldoria` e `coi-ticket.<ticket>`.
6. Worker encaminha o ticket em header apenas no salto interno Worker → Durable Object.
7. Durable Object consome o ticket em uma transação de storage, impedindo replay, e negocia de volta somente `coi-eldoria`. O ticket não é ecoado no protocolo negociado.
8. Tickets não utilizados são removidos por Alarm após expirar.

O token principal nunca é colocado na URL, no nome da sala ou no protocolo WebSocket.

Exemplo conceitual de cliente (a integração real às telas está na issue #123):

```js
const ticketResponse = await request("/realtime/eldoria/ticket", {
  method: "POST"
});
if (!ticketResponse.ok) throw new Error("Realtime indisponível");
const { ticket } = await ticketResponse.json();
const socket = new WebSocket("wss://" + location.host + "/api/realtime/eldoria", [
  "coi-eldoria",
  "coi-ticket." + ticket
]);
```

## Endpoints

- `POST /api/realtime/eldoria/ticket`: requer sessão de jogo válida.
- `GET /api/realtime/eldoria`: handshake WebSocket com ticket single-use.

Mensagens aceitas nesta fase:
- `{"type":"ping"}` → resposta `{"type":"pong"}`.
- Qualquer outro tipo recebe `unsupported_message`; mensagens arbitrárias do cliente não são retransmitidas nem alteram o estado do jogo.

Eventos enviados:
- `connected`: confirmação da conexão.
- `presence`: quantidade agregada de conexões na sala; nenhum ID de jogador é divulgado.

## Previews e infraestrutura

- `wrangler.jsonc` declara D1 Preview diferente do D1 de produção.
- Como o Worker acessa o Durable Object por `env.ELDORIA_ROOM`, o binding do DO também está declarado no bloco `previews`.
- O teste de contrato verifica que o D1 de Preview não é igual ao D1 de produção e que a rota de ticket autentica o jogador antes de chamar o DO.
- A existência e acessibilidade remota do D1 candidato ainda precisam ser confirmadas antes de migrations remotas.
- Segredos de Preview devem ser configurados separadamente e nunca copiados de produção.
- Cron Triggers não executam em Previews; o scheduler deve ser validado localmente/ambiente descartável.

## Ativação

A classe e a migration de infraestrutura são declaradas no Wrangler. A criação do namespace só ocorre quando uma implantação com essa configuração é concluída.

Antes de promover:
1. executar `npm test` e `npm run check`;
2. validar o D1 Preview remoto e as migrations nele, nunca no banco de produção;
3. testar o ticket expirado/reutilizado, handshake com dois clientes, heartbeat e desconexão;
4. integrar o cliente às telas conforme issue #123;
5. observar custos e métricas antes de expor a conexão publicamente.

## Limitações e escala

Esta fase não sincroniza movimentos, chat global, castelos, marchas ou batalhas em tempo real. O limite 200 é um guard rail para piloto. A sala atual ainda usa um único ID lógico (`eldoria`), portanto não deve ser tratada como arquitetura final para milhares de conexões.

A evolução paga precisa particionar as salas por região/célula calculada no servidor e implementar handoff. O reino de produto continua único: particionamento técnico de salas não cria mundos privados. D1 continua autoridade dos resultados econômicos/combate. Não confiar em estado enviado pelo cliente.

A conexão usa a API de WebSocket do Durable Object. A implementação deve continuar usando a interface de Hibernation WebSocket e validar o comportamento/custo em staging antes de produção.
