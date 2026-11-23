import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const begin = html.indexOf("function readKingdomGameToken(){");
const end = html.indexOf("let kingdomConnectInFlight=false;", begin);
assert.ok(begin > 0 && end > begin, "token storage helpers must exist");
const helpers = html.slice(begin, end);

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}
const denied = {
  getItem() { throw new Error("denied"); },
  setItem() { throw new Error("denied"); },
  removeItem() { throw new Error("denied"); }
};
function sandbox(local, session, memory = null) {
  const ctx = vm.createContext({ localStorage: local, sessionStorage: session, token: memory });
  vm.runInContext(helpers, ctx);
  return expr => vm.runInContext(expr, ctx);
}

test("reino retoma token do sessionStorage quando localStorage falha", () => {
  const session = storage({ coi_game_token: "existing-kingdom-session" });
  const run = sandbox(denied, session);
  assert.equal(run("readKingdomGameToken()"), "existing-kingdom-session");
  run('token = "existing-kingdom-session"');
  assert.equal(run("saveKingdomGameToken()"), true);
  assert.equal(session.getItem("coi_game_token"), "existing-kingdom-session");
  assert.equal(run("canPersistKingdomGameToken()"), true);
});

test("reino não cria conta anônima quando nenhum armazenamento funciona", () => {
  const run = sandbox(denied, denied);
  assert.throws(() => run("readKingdomGameToken()"), /bloqueou o armazenamento/);
  assert.equal(run("canPersistKingdomGameToken()"), false);
  const connect = html.slice(html.indexOf("async function connect(){"), html.indexOf("function drawKingdomScene(", html.indexOf("async function connect(){")));
  const preflight = connect.indexOf("if(!canPersistKingdomGameToken())");
  const createGuest = connect.indexOf('request("/game/start"');
  assert.ok(preflight >= 0 && createGuest > preflight, "storage must be writable before creating a guest account");
  assert.doesNotMatch(connect, /localStorage\\.getItem|sessionStorage\\.getItem/);
});

test("token em memória permanece disponível após bloqueio de ambos os armazenamentos", () => {
  const run = sandbox(denied, denied, "in-memory-kingdom-token");
  assert.equal(run("readKingdomGameToken()"), "in-memory-kingdom-token");
  assert.equal(run("saveKingdomGameToken()"), false);
});
