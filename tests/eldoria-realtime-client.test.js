import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readGameToken, readRealtimePacket, requestRealtimeTicket } from "../scripts/eldoria-realtime-client.js";

test("realtime client reads only existing game session storage", () => {
  const fail = { getItem() { throw new Error("storage blocked"); } };
  const good = { getItem(key) { return key === "coi_game_token" ? "valid-session" : null; } };
  assert.equal(readGameToken(fail, good), "valid-session");
  assert.equal(readGameToken(null, null), "");
});

test("presence messages are restricted to aggregate Eldoria counts", () => {
  assert.deepEqual(readRealtimePacket('{"type":"presence","room":"eldoria","online":13}'), { type: "presence", online: 13 });
  assert.deepEqual(readRealtimePacket('{"type":"connected","playerId":"private"}'), { type: "connected" });
  for (const raw of ['{"type":"presence","room":"other","online":2}', '{"type":"presence","room":"eldoria","online":1000}',
    '{"type":"admin","command":"grant-gems"}', '{', "z".repeat(513)]) {
    assert.equal(readRealtimePacket(raw), null);
  }
});

test("ticket request uses same-origin POST and Bearer, and rejects malformed tickets", async () => {
  const expectedTicket = "a".repeat(72);
  let observed;
  const fetchImpl = async (url, options) => {
    observed = { url, options };
    return new Response(JSON.stringify({ ticket: expectedTicket }), {
      status: 201, headers: { "content-type": "application/json" }
    });
  };
  assert.deepEqual(await requestRealtimeTicket({ token: "private-token", fetchImpl }), { ticket: expectedTicket, room: null });
  assert.equal(observed.url, "/api/realtime/eldoria/ticket");
  assert.equal(observed.options.method, "POST");
  assert.equal(observed.options.redirect, "error");
  assert.equal(observed.options.credentials, "same-origin");
  assert.equal(observed.options.headers.Authorization, "Bearer private-token");
  assert.equal(observed.options.headers["X-COI-Shard-Support"], "1");
  await assert.rejects(requestRealtimeTicket({ token: "", fetchImpl }));
  await assert.rejects(requestRealtimeTicket({
    token: "valid", fetchImpl: async () => new Response('{"ticket":"bad"}', { status: 201 })
  }));
  await assert.rejects(requestRealtimeTicket({
    token: "valid", fetchImpl: async () => new Response('{"error":"missing"}', { status: 503 })
  }));
  assert.deepEqual(await requestRealtimeTicket({ token: "valid", fetchImpl: async () =>
    new Response(JSON.stringify({ ticket: expectedTicket, room: 7 }), { status: 201 })
  }), { ticket: expectedTicket, room: 7 });
  await assert.rejects(requestRealtimeTicket({ token: "valid", fetchImpl: async () =>
    new Response(JSON.stringify({ ticket: expectedTicket, room: 8 }), { status: 201 })
  }));
});

test("kingdom displays realtime status without exposing principal token in a URL", async () => {
  const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
  const client = await readFile(new URL("../scripts/eldoria-realtime-client.js", import.meta.url), "utf8");
  assert.match(html, /id="eldoriaPresence"/);
  assert.match(html, /startRealtimePresence\(\)/);
  assert.match(client, /"wss:\/\/" \+ windowRef\.location\.host/);
  assert.doesNotMatch(client, /new WebSocketImpl\([^;\n]*\+ token/);
});
