import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("public stats keep verified gameplay counters independent from migration 0039", async () => {
  const [worker, migration] = await Promise.all([
    read("worker.js"), read("migrations/0039_support_orders.sql")
  ]);
  const start = worker.indexOf('if(url.pathname==="/api/public/stats")');
  const end = worker.indexOf('if(!env.DB)return json({error:"Banco D1 não vinculado ao Worker."}', start);
  assert.ok(start >= 0 && end > start);
  const route = worker.slice(start, end);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS support_orders/);
  assert.match(route, /SELECT name FROM sqlite_master/);
  assert.match(route, /tables\.has\("support_orders"\)\?statements\.push/);
  assert.match(route, /const supportVerified=packageIndex>=0&&voluntaryIndex>=0/);
  assert.match(route, /supportTotalCents:supportVerified\?packages\+voluntary:null/);
  assert.match(route, /verified:true/);
  assert.doesNotMatch(route, /\.run\(\)|\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
});

test("marketing portals stay identical and never expose invented counters or financial claims", async () => {
  const [a, b] = await Promise.all([
    read("portal.html"), read("public-portal/portal.html")
  ]);
  assert.equal(a, b);
  assert.match(a, /Baixar APK Android/);
  assert.match(a, /href="\/apoie\.html"/);
  assert.doesNotMatch(a, /data\.supportVerified|supportTotalCents|support-goal|players-count|battles-count|alliances-count|loadPublicStats/);
  assert.doesNotMatch(a, /api\/public\/stats/);
});

test("support page does not present unavailable contributions as R$0", async () => {
  const [a, b] = await Promise.all([
    read("apoie.html"), read("public-portal/apoie.html")
  ]);
  assert.equal(a, b);
  assert.match(a, /stats\.supportVerified!==true/);
  assert.match(a, /Totais financeiros ainda não verificados/);
});

