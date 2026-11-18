import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EldoriaRoom } from "../eldoria-room.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

function roomWith(sockets = []) {
  return new EldoriaRoom({ getWebSockets: () => sockets }, {});
}

test("Eldoria realtime Preview binds an isolated D1 and its own Durable Object namespace", async () => {
  const config = JSON.parse(await read("wrangler.jsonc"));
  const productionDb = config.d1_databases.find(binding => binding.binding === "DB");
  const previewDb = config.previews?.d1_databases?.find(binding => binding.binding === "DB");
  const previewRoom = config.previews?.durable_objects?.bindings?.find(binding => binding.name === "ELDORIA_ROOM");

  assert.ok(productionDb?.database_id, "production D1 remains configured");
  assert.ok(previewDb?.database_id, "Preview must bind a D1 database");
  assert.notEqual(previewDb.database_id, productionDb.database_id, "Preview must never bind production D1");
  assert.equal(previewDb.database_id, "6674c0ac-3636-4e57-bff8-23cf60ab9637");
  assert.equal(previewDb.database_name, "izzy-preview-17112026");
  assert.equal(config.previews.vars.ENVIRONMENT, "preview");
  assert.equal(previewRoom?.class_name, "EldoriaRoom");
  assert.ok(config.durable_objects.bindings.some(binding => binding.name === "ELDORIA_ROOM"));
  assert.ok(config.migrations.some(migration => migration.new_sqlite_classes?.includes("EldoriaRoom")));

  const worker = await read("worker.js");
  const routeStart = worker.indexOf('if(url.pathname==="/api/realtime/eldoria")');
  const authCheck = worker.indexOf("const playerId=await gameIdentity(request,env)", routeStart);
  const doForward = worker.indexOf("env.ELDORIA_ROOM.get(roomId).fetch", routeStart);
  assert.ok(routeStart >= 0 && authCheck > routeStart && doForward > authCheck,
    "the Worker must authenticate the game session before forwarding to the Durable Object");
});

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
