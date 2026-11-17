import test from "node:test";
import assert from "node:assert/strict";
import { EldoriaRoom } from "../eldoria-room.js";

function roomWith(sockets = []) {
  return new EldoriaRoom({ getWebSockets: () => sockets }, {});
}

test("Eldoria responde pong a heartbeat válido", async () => {
  const sent = [];
  const room = roomWith([]);
  await room.webSocketMessage({ send: value => sent.push(JSON.parse(value)) }, JSON.stringify({ type: "ping" }));
  assert.equal(sent[0].type, "pong");
  assert.equal(typeof sent[0].at, "number");
});

test("Eldoria rejeita mensagens desconhecidas sem retransmitir conteúdo", async () => {
  const sent = [];
  const room = roomWith([]);
  await room.webSocketMessage({ send: value => sent.push(JSON.parse(value)) }, JSON.stringify({ type: "admin", command: "grant-gems" }));
  assert.deepEqual(sent, [{ type: "error", code: "unsupported_message" }]);
});

test("Eldoria informa JSON inválido", async () => {
  const sent = [];
  const room = roomWith([]);
  await room.webSocketMessage({ send: value => sent.push(JSON.parse(value)) }, "{");
  assert.deepEqual(sent, [{ type: "error", code: "invalid_json" }]);
});

test("Eldoria encerra payloads grandes", async () => {
  let closed;
  const room = roomWith([]);
  await room.webSocketMessage({ send() {}, close: (...args) => { closed = args; } }, "x".repeat(1025));
  assert.equal(closed[0], 1009);
});

test("Eldoria publica somente a quantidade de conexões online", () => {
  const messages = [[], []];
  const sockets = messages.map(sent => ({ send: value => sent.push(JSON.parse(value)) }));
  const room = roomWith(sockets);
  room.broadcastPresence();
  assert.deepEqual(messages.map(items => items[0]), [
    { type: "presence", online: 2, room: "eldoria" },
    { type: "presence", online: 2, room: "eldoria" }
  ]);
});
