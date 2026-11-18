import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EldoriaRoom } from "../eldoria-room.js";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

function roomContext(sockets = []) {
  const entries = new Map();
  let alarm = null;
  const storage = {
    put: async (key, value) => entries.set(key, value),
    get: async key => entries.get(key),
    delete: async key => entries.delete(key),
    getAlarm: async () => alarm,
    setAlarm: async value => { alarm = value; },
    list: async ({ prefix = "" } = {}) => new Map([...entries].filter(([key]) => key.startsWith(prefix))),
    transaction: async callback => callback({
      get: async key => entries.get(key),
      delete: async key => entries.delete(key)
    })
  };
  return {
    ctx: { getWebSockets: () => sockets, storage },
    entries,
    getAlarm: () => alarm
  };
}

function roomWith(sockets = []) {
  return new EldoriaRoom(roomContext(sockets).ctx, {});
}

test("Eldoria realtime Preview binds isolated D1 and Durable Object", async () => {
  const config = JSON.parse(await read("wrangler.jsonc"));
  const productionDb = config.d1_databases.find(binding => binding.binding === "DB");
  const previewDb = config.previews?.d1_databases?.find(binding => binding.binding === "DB");
  const previewRoom = config.previews?.durable_objects?.bindings?.find(binding => binding.name === "ELDORIA_ROOM");

  assert.ok(productionDb?.database_id, "production D1 remains configured");
  assert.ok(previewDb?.database_id, "Preview D1 must be configured");
  assert.notEqual(previewDb.database_id, productionDb.database_id, "Preview must never bind production D1");
  assert.equal(previewDb.database_id, "6674c0ac-3636-4e57-bff8-23cf60ab9637");
  assert.equal(previewDb.database_name, "izzy-preview-17112026");
  assert.equal(config.previews.vars.ENVIRONMENT, "preview");
  assert.equal(previewRoom?.class_name, "EldoriaRoom");
  assert.ok(config.durable_objects.bindings.some(binding => binding.name === "ELDORIA_ROOM"));
  assert.ok(config.migrations.some(migration => migration.new_sqlite_classes?.includes("EldoriaRoom")));

  const worker = await read("worker.js");
  const ticketRoute = worker.indexOf('if(url.pathname==="/api/realtime/eldoria/ticket")');
  const socketRoute = worker.indexOf('if(url.pathname==="/api/realtime/eldoria"){');
  const authCheck = worker.indexOf("gameIdentity(request,env)", ticketRoute);
  assert.ok(ticketRoute >= 0 && authCheck > ticketRoute);
  assert.ok(socketRoute > ticketRoute);
  assert.ok(worker.slice(socketRoute, worker.indexOf('if(url.pathname==="/api/email/verify"', socketRoute)).includes("X-COI-Realtime-Ticket"));
});

test("ticket issuance creates opaque expiring ticket and schedules cleanup", async () => {
  const fake = roomContext([]);
  const room = new EldoriaRoom(fake.ctx, {});
  const response = await room.fetch(new Request("https://eldoria.internal/ticket", {
    method: "POST",
    headers: { "X-COI-Player-Id": "izzy_0123456789abcdef0123456789abcdef" }
  }));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.ticket, /^[a-f0-9-]{72}$/i);
  assert.equal(body.expiresAt > Date.now(), true);
  assert.equal(fake.entries.get("realtime-ticket:" + body.ticket).playerId, "izzy_0123456789abcdef0123456789abcdef");
  assert.equal(fake.getAlarm(), body.expiresAt);
});

test("ticket endpoint rejects missing and malformed internal identities", async () => {
  const room = roomWith([]);
  const missing = await room.fetch(new Request("https://eldoria.internal/ticket", { method: "POST" }));
  const malformed = await room.fetch(new Request("https://eldoria.internal/ticket", {
    method: "POST",
    headers: { "X-COI-Player-Id": "player-admin" }
  }));
  assert.equal(missing.status, 401);
  assert.equal(malformed.status, 401);
});

test("tickets are short-lived and single-use", async () => {
  const fake = roomContext([]);
  const room = new EldoriaRoom(fake.ctx, {});
  const validResponse = await room.fetch(new Request("https://eldoria.internal/ticket", {
    method: "POST",
    headers: { "X-COI-Player-Id": "izzy_0123456789abcdef0123456789abcdef" }
  }));
  const valid = await validResponse.json();
  assert.ok(await room.consumeTicket(valid.ticket));
  assert.equal(await room.consumeTicket(valid.ticket), null, "a consumed ticket cannot be replayed");

  const expiredTicket = "a".repeat(72);
  fake.entries.set("realtime-ticket:" + expiredTicket, {
    playerId: "izzy_0123456789abcdef0123456789abcdef",
    expiresAt: Date.now() - 1000
  });
  assert.equal(await room.consumeTicket(expiredTicket), null);
  assert.equal(fake.entries.has("realtime-ticket:" + expiredTicket), false);
});

test("alarm deletes expired tickets and keeps the next expiry scheduled", async () => {
  const fake = roomContext([]);
  const room = new EldoriaRoom(fake.ctx, {});
  fake.entries.set("realtime-ticket:" + "a".repeat(72), { expiresAt: Date.now() - 1 });
  fake.entries.set("realtime-ticket:" + "b".repeat(72), { expiresAt: Date.now() + 20_000 });
  await room.alarm();
  assert.equal(fake.entries.size, 1);
  assert.ok(fake.getAlarm() > Date.now());
});

test("WebSocket handshake rejects missing tickets before accepting a connection", async () => {
  const room = roomWith([]);
  const response = await room.fetch(new Request("https://eldoria.internal/socket", {
    method: "GET",
    headers: { "Upgrade": "websocket", "Sec-WebSocket-Protocol": "coi-eldoria" }
  }));
  assert.equal(response.status, 401);
});

test("Eldoria responds pong to valid heartbeat", async () => {
  const sent = [];
  const room = roomWith([]);
  await room.webSocketMessage({ send: value => sent.push(JSON.parse(value)) }, JSON.stringify({ type: "ping" }));
  assert.equal(sent[0].type, "pong");
  assert.equal(typeof sent[0].at, "number");
});

test("Eldoria rejects unknown messages without retransmitting their contents", async () => {
  const sent = [];
  const room = roomWith([]);
  await room.webSocketMessage({ send: value => sent.push(JSON.parse(value)) }, JSON.stringify({ type: "admin", command: "grant-gems" }));
  assert.deepEqual(sent, [{ type: "error", code: "unsupported_message" }]);
});

test("Eldoria reports invalid JSON", async () => {
  const sent = [];
  const room = roomWith([]);
  await room.webSocketMessage({ send: value => sent.push(JSON.parse(value)) }, "{");
  assert.deepEqual(sent, [{ type: "error", code: "invalid_json" }]);
});

test("Eldoria closes oversized payloads", async () => {
  let closed;
  const room = roomWith([]);
  await room.webSocketMessage({ send() {}, close: (...args) => { closed = args; } }, "x".repeat(1025));
  assert.equal(closed[0], 1009);
});

test("Eldoria broadcasts only the aggregate online connection count", () => {
  const messages = [[], []];
  const sockets = messages.map(sent => ({ send: value => sent.push(JSON.parse(value)) }));
  const room = roomWith(sockets);
  room.broadcastPresence();
  assert.deepEqual(messages.map(items => items[0]), [
    { type: "presence", online: 2, room: "eldoria" },
    { type: "presence", online: 2, room: "eldoria" }
  ]);
});
