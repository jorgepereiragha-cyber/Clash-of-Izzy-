import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readGameToken, readRealtimePacket, requestRealtimeTicket, startRealtimePresence, realtimeRetryDelay } from "../scripts/eldoria-realtime-client.js";

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

function mockPresenceEnvironment(fetchImpl, configureWindow = () => {}) {
  const events = (target => ({
    target,
    handlers: new Map(),
    addEventListener(name, callback) { this.handlers.set(name, callback); },
    removeEventListener(name) { this.handlers.delete(name); },
    emit(name, event = {}) { this.handlers.get(name)?.(event); }
  }));
  const documentRef = events();
  documentRef.hidden = false;
  const status = { textContent: "" };
  documentRef.getElementById = id => id === "eldoriaPresence" ? status : null;
  const windowRef = events();
  windowRef.navigator = { onLine: true };
  windowRef.location = { protocol: "https:", host: "play.example" };
  windowRef.localStorage = { getItem: () => "valid-game-token" };
  windowRef.sessionStorage = { getItem: () => null };
  configureWindow(windowRef);
  const sockets = [];
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url, protocols) {
      this.url = url;
      this.protocols = protocols;
      this.listeners = new Map();
      this.readyState = 0;
      this.closed = false;
      sockets.push(this);
    }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    close() { this.closed = true; }
    send() {}
  }
  const stop = startRealtimePresence({ documentRef, windowRef, fetchImpl, WebSocketImpl: FakeWebSocket });
  return { documentRef, windowRef, status, sockets, stop };
}

const validTicketResponse = (ticket = "a".repeat(72)) => new Response(
  JSON.stringify({ ticket, room: 0 }), { status: 201, headers: { "content-type": "application/json" } }
);
const flushMicrotasks = async () => {
  for (let n = 0; n < 8; n++) await Promise.resolve();
};

test("restricted WebView storage getters recover using the alternate session", async () => {
  let calls = 0;
  const env = mockPresenceEnvironment(async (_url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, "Bearer fallback-session");
    return validTicketResponse();
  }, windowRef => {
    Object.defineProperty(windowRef, "localStorage", { get() { throw new Error("SecurityError"); } });
    windowRef.sessionStorage = { getItem: () => "fallback-session" };
  });
  try {
    await flushMicrotasks();
    assert.equal(calls, 1);
    assert.equal(env.sockets.length, 1);
  } finally { env.stop(); }
});

test("both blocked storage getters fail closed without requesting a ticket", async () => {
  let calls = 0;
  const env = mockPresenceEnvironment(async () => {
    calls++;
    return validTicketResponse();
  }, windowRef => {
    for (const key of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(windowRef, key, { get() { throw new Error("SecurityError"); } });
    }
  });
  try {
    await flushMicrotasks();
    assert.equal(calls, 0);
    assert.equal(env.sockets.length, 0);
    assert.match(env.status.textContent, /Entre na conta/);
  } finally { env.stop(); }
});

test("realtime client permits only one ticket request when multiple resume events race", async () => {
  let resolveTicket;
  let count = 0;
  const fetchImpl = () => {
    count++;
    return new Promise(resolve => { resolveTicket = resolve; });
  };
  const client = mockPresenceEnvironment(fetchImpl);
  try {
    client.windowRef.emit("online");
    client.documentRef.emit("visibilitychange");
    assert.equal(count, 1, "parallel triggers cannot create two pending tickets");
    resolveTicket(validTicketResponse());
    await flushMicrotasks();
    assert.equal(client.sockets.length, 1, "only one WebSocket created");
  } finally { client.stop(); }
});

test("realtime client cancels stale ticket completions during hide and reconnect", async () => {
  const pending = [];
  const fetchImpl = (_url, options) => new Promise(resolve => pending.push({ resolve, signal: options.signal }));
  const client = mockPresenceEnvironment(fetchImpl);
  try {
    assert.equal(pending.length, 1);
    client.documentRef.hidden = true;
    client.documentRef.emit("visibilitychange");
    assert.equal(pending[0].signal.aborted, true);
    client.documentRef.hidden = false;
    client.documentRef.emit("visibilitychange");
    assert.equal(pending.length, 2);
    pending[0].resolve(validTicketResponse("b".repeat(72)));
    await flushMicrotasks();
    assert.equal(client.sockets.length, 0, "stale credential must never open a socket");
    pending[1].resolve(validTicketResponse());
    await flushMicrotasks();
    assert.equal(client.sockets.length, 1, "only latest credential is usable");
  } finally { client.stop(); }
});

test("bfcache pageshow restores WebSocket presence and shutdown removes listeners", async () => {
  const client = mockPresenceEnvironment(async () => validTicketResponse());
  try {
    await flushMicrotasks();
    assert.equal(client.sockets.length, 1);
    client.windowRef.emit("pagehide");
    assert.equal(client.sockets[0].closed, true, "pagehide closes original socket");
    client.windowRef.emit("pageshow", { persisted: true });
    await flushMicrotasks();
    assert.equal(client.sockets.length, 2, "restored page must reconnect");
  } finally { client.stop(); }
  assert.equal(client.windowRef.handlers.has("pageshow"), false, "cleanup detaches pageshow listener");
});


test("reconnect delay uses bounded exponential equal jitter", () => {
  for (const [attempt, cap] of [[1,1000],[2,2000],[3,4000],[4,8000],[5,16000],[6,30000],[99,30000]]) {
    assert.equal(realtimeRetryDelay(attempt,()=>0),cap/2);
    assert.equal(realtimeRetryDelay(attempt,()=>1),cap);
    assert.ok(realtimeRetryDelay(attempt,()=>0.4)<realtimeRetryDelay(attempt,()=>0.8));
  }
  assert.equal(realtimeRetryDelay(NaN,()=>NaN),750);
});
