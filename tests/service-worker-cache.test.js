import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const ORIGIN = "https://clash-of-izzy.example";

function makeResponse({ status = 200, headers = {}, type = "basic" } = {}) {
  return {
    status,
    type,
    headers: new Headers(headers),
    clone() { return makeResponse({ status, headers, type }); },
  };
}

function makeHarness(responder = () => makeResponse(), { failCacheWrites = false } = {}) {
  const listeners = {};
  const stores = new Map();
  const networkCalls = [];
  let shouldRejectNetwork = false;

  function getStore(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }

  const caches = {
    async open(name) {
      const store = getStore(name);
      return {
        async addAll(paths) {
          for (const path of paths) store.set(path, makeResponse());
        },
        async match(key) { return store.get(key); },
        async put(key, response) { if (failCacheWrites) throw new Error("QuotaExceeded"); store.set(key, response); },
        async keys() { return [...store.keys()]; },
        async delete(key) { return store.delete(key); },
      };
    },
    async match(key) {
      for (const store of stores.values()) {
        if (store.has(key)) return store.get(key);
      }
      return undefined;
    },
    async keys() { return [...stores.keys()]; },
    async delete(key) { return stores.delete(key); },
  };

  const self = {
    location: { origin: ORIGIN },
    clients: { claim() { return Promise.resolve(); } },
    skipWaiting() { return Promise.resolve(); },
    addEventListener(name, listener) { listeners[name] = listener; },
  };

  vm.runInNewContext(source, {
    self, caches, URL, Headers,
    fetch: async request => {
      networkCalls.push(request.url);
      if (shouldRejectNetwork) throw new Error("offline");
      return responder(request);
    },
  }, { filename: "sw.js" });

  async function dispatch(path, { mode = "cors", method = "GET", headers = {} } = {}) {
    const request = {
      url: new URL(path, ORIGIN).href,
      mode,
      method,
      headers: new Headers(headers),
    };
    let handled = false;
    let response;
    listeners.fetch({
      request,
      respondWith(promise) {
        handled = true;
        response = Promise.resolve(promise);
      },
    });
    return { handled, result: handled ? await response : undefined };
  }

  async function lifecycle(name) {
    let promise;
    listeners[name]({ waitUntil(task) { promise = Promise.resolve(task); } });
    await promise;
  }

  return {
    dispatch, lifecycle, caches, stores, networkCalls,
    offline(value = true) { shouldRejectNetwork = value; },
  };
}

test("PWA never intercepts APIs, authenticated requests, non-GET methods, or other origins", async () => {
  const h = makeHarness();
  for (const [url, options] of [
    ["/api/game/state", {}],
    ["/world.html", { headers: { Authorization: "Bearer private" } }],
    ["/world.html", { method: "POST" }],
    ["https://untrusted.example/assets/3d/house.glb", {}],
  ]) {
    assert.equal((await h.dispatch(url, options)).handled, false, url);
  }
  assert.equal(h.stores.size, 0);
  assert.equal(h.networkCalls.length, 0);
});

test("PWA fetches query-bearing navigation but never stores its parameters or response", async () => {
  const h = makeHarness();
  const first = await h.dispatch("/world.html?search=private-player", { mode: "navigate" });
  assert.equal(first.handled, true);
  assert.equal(first.result.status, 200);
  assert.equal(h.stores.size, 0);
  assert.equal(h.networkCalls.length, 1);

  await (await h.caches.open("clash-of-izzy-shell-v29"))
    .put("/world.html", makeResponse());
  h.offline();
  const offline = await h.dispatch("/world.html?search=private-player", { mode: "navigate" });
  assert.equal(offline.result.status, 200);
  assert.ok(![...h.stores.values()].some(store => [...store.keys()].some(key => key.includes("?"))));
});

test("PWA shell responses are cached by pathname and serve offline fallback", async () => {
  const h = makeHarness();
  const first = await h.dispatch("/kingdom.html", { mode: "navigate" });
  assert.equal(first.handled, true);
  assert.equal(first.result.status, 200);
  assert.ok(h.stores.get("clash-of-izzy-shell-v29").has("/kingdom.html"));
  h.offline();
  const fallback = await h.dispatch("/unknown-route?token=sensitive", { mode: "navigate" });
  assert.equal(fallback.result, undefined);
  await (await h.caches.open("clash-of-izzy-shell-v29"))
    .put("/offline.html", makeResponse());
  const offline = await h.dispatch("/unknown-route?token=sensitive", { mode: "navigate" });
  assert.equal(offline.result.status, 200);
});

test("PWA only adds approved static assets without query strings", async () => {
  const h = makeHarness();
  assert.equal((await h.dispatch("/assets/3d/model.glb")).handled, true);
  assert.equal(h.stores.get("clash-of-izzy-runtime-v1").has("/assets/3d/model.glb"), true);
  assert.equal((await h.dispatch("/assets/3d/model.glb?token=secret")).handled, false);
  assert.equal((await h.dispatch("/account/status")).handled, false);
  assert.equal((await h.dispatch("/assets/private-data.json")).handled, false);
  assert.equal((await h.dispatch("/uploads/private-avatar.png")).handled, false);
});

test("PWA never stores private, no-store, error, cookie-bearing or opaque responses", async () => {
  const variants = [
    makeResponse({ headers: { "cache-control": "private, max-age=60" } }),
    makeResponse({ headers: { "cache-control": "no-store" } }),
    makeResponse({ headers: { "cache-control": "no-cache" } }),
    makeResponse({ headers: { "set-cookie": "session=x" } }),
    makeResponse({ status: 404 }),
    makeResponse({ type: "opaque" }),
  ];
  for (const variant of variants) {
    const h = makeHarness(() => variant);
    const result = await h.dispatch("/assets/3d/house.glb");
    assert.equal(result.handled, true);
    assert.equal(h.stores.get("clash-of-izzy-runtime-v1")?.size ?? 0, 0);
  }
});

test("PWA bounds its runtime asset cache and retires older named caches", async () => {
  const h = makeHarness();
  for (let i = 0; i < 70; i += 1) {
    await h.dispatch("/assets/3d/model-" + i + ".glb");
  }
  assert.equal(h.stores.get("clash-of-izzy-runtime-v1").size, 64);
  assert.equal(h.stores.get("clash-of-izzy-runtime-v1").has("/assets/3d/model-0.glb"), false);
  assert.equal(h.stores.get("clash-of-izzy-runtime-v1").has("/assets/3d/model-69.glb"), true);
  await h.caches.open("clash-of-izzy-shell-v29");
  await h.caches.open("clash-of-izzy-runtime-v0");
  await h.lifecycle("activate");
  assert.equal(h.stores.has("clash-of-izzy-shell-v29"), false);
  assert.equal(h.stores.has("clash-of-izzy-runtime-v0"), false);
  assert.equal(h.stores.has("clash-of-izzy-runtime-v1"), true);
});

test("network success is returned even when cache storage rejects writes", async () => {
  const h = makeHarness(() => makeResponse(), { failCacheWrites: true });
  const navigation = await h.dispatch("/world.html", { mode: "navigate" });
  assert.equal(navigation.result.status, 200);
  const asset = await h.dispatch("/assets/3d/house.glb");
  assert.equal(asset.result.status, 200);
});
