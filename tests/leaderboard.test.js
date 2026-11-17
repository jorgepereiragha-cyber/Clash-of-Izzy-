import test from "node:test";
import assert from "node:assert/strict";
import { handleLeaderboardRoute } from "../leaderboard.js";

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json", ...headers }
});
const read = async response => ({ status: response.status, body: await response.json() });

function fakeDb({ total = 0, rows = [] } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      calls.push({ sql, values: [] });
      const call = calls[calls.length - 1];
      return {
        bind(...values) { call.values = values; return this; },
        async first() { return { total }; },
        async all() { return { results: rows }; }
      };
    }
  };
}

test("public leaderboard rejects unsupported methods and categories", async () => {
  const env = { DB: fakeDb() };
  const options = { json, rateLimitDecision: async () => null };
  const method = await read(await handleLeaderboardRoute(new Request("https://coi.test/api/leaderboard", { method: "POST" }), env, options));
  const category = await read(await handleLeaderboardRoute(new Request("https://coi.test/api/leaderboard?type=players"), env, options));
  assert.equal(method.status, 405);
  assert.equal(category.status, 400);
});

test("kingdom leaderboard returns only public fields and applies bounded pagination", async () => {
  const DB = fakeDb({
    total: 53,
    rows: [
      { commander_name: "Lobo", kingdom_name: "Valedouro", castle_level: 18, power: 98500, alliance_tag: "VAL", updated_at: "2026-11-17" },
      { commander_name: "Águia", kingdom_name: "Altaneira", castle_level: 15, power: 86000, alliance_tag: "", updated_at: "2026-11-16" }
    ]
  });
  let rateLimitArgs = null;
  const response = await handleLeaderboardRoute(
    new Request("https://coi.test/api/leaderboard?type=kingdoms&page=2&limit=500", { headers: { "CF-Connecting-IP": "203.0.113.10" } }),
    { DB },
    { json, rateLimitDecision: async (...args) => { rateLimitArgs = args; return null; } }
  );
  const result = await read(response);
  assert.equal(result.status, 200);
  assert.equal(result.body.type, "kingdoms");
  assert.equal(result.body.page, 2);
  assert.equal(result.body.limit, 50);
  assert.equal(result.body.total, 53);
  assert.equal(result.body.pages, 2);
  assert.equal(result.body.results[0].rank, 51);
  assert.equal(result.body.results[0].commander, "Lobo");
  assert.equal(result.body.results[0].power, 98500);
  assert.equal("player_id" in result.body.results[0], false);
  assert.equal("email" in result.body.results[0], false);
  assert.equal(rateLimitArgs[1], "leaderboard-public-ip");
  assert.equal(DB.calls[1].values[0], 50);
  assert.equal(DB.calls[1].values[1], 50);
  assert.match(DB.calls[1].sql, /ORDER BY k\.power DESC/);
});

test("alliance leaderboard aggregates member power and omits empty alliances", async () => {
  const DB = fakeDb({
    total: 1,
    rows: [{ name: "Sentinelas do Norte", tag: "SN", level: 9, xp: 4200, member_count: 7, total_power: 710000, territory_count: 4 }]
  });
  const result = await read(await handleLeaderboardRoute(
    new Request("https://coi.test/api/leaderboard?type=alliances"),
    { DB },
    { json, rateLimitDecision: async () => null }
  ));
  assert.equal(result.status, 200);
  assert.equal(result.body.results[0].name, "Sentinelas do Norte");
  assert.equal(result.body.results[0].members, 7);
  assert.equal(result.body.results[0].power, 710000);
  assert.match(DB.calls[0].sql, /EXISTS\(SELECT 1 FROM alliance_members/);
  assert.match(DB.calls[1].sql, /SUM\(k\.power\)/);
});

test("public leaderboard fails closed when rate limiting or D1 fails", async () => {
  const limited = new Response(JSON.stringify({ error: "rate limited" }), { status: 429 });
  const response = await handleLeaderboardRoute(
    new Request("https://coi.test/api/leaderboard"),
    { DB: fakeDb() },
    { json, rateLimitDecision: async () => limited }
  );
  assert.equal(response.status, 429);

  const broken = await handleLeaderboardRoute(
    new Request("https://coi.test/api/leaderboard"),
    { DB: { prepare() { throw new Error("D1 unavailable"); } } },
    { json, rateLimitDecision: async () => null }
  );
  assert.equal(broken.status, 503);
  assert.match((await broken.json()).error, /temporariamente indisponível/);
});

test("ranking page and shared navigation expose the feature and PWA assets include it", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
  const page = await read("ranking.html");
  const script = await read("ranking.js");
  const nav = await read("navigation.js");
  const worker = await read("sw.js");
  assert.match(page, /Salão da Coroa/);
  assert.match(script, /\/api\/leaderboard/);
  assert.match(nav, /Ranking global/);
  assert.match(worker, /\/ranking\.html/);
  assert.match(worker, /\/ranking\.js/);
});
