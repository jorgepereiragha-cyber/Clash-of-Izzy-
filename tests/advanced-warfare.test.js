import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("migration avançada cria nós, rallies e pesquisa com escopo de reino", async () => {
 const sql=await read("migrations/0021_advanced_warfare.sql");
 for(const table of ["resource_nodes","rallies","rally_reinforcements","kingdom_tech","tech_catalog"])
  assert.match(sql,new RegExp("CREATE TABLE IF NOT EXISTS "+table+"\\b"));
 assert.match(sql,/WITH RECURSIVE seq\(n\)/);
 assert.match(sql,/n<99/);
 assert.match(sql,/reserved_by_rally/);
 assert.match(sql,/FOREIGN KEY|REFERENCES kingdoms/);
 assert.match(sql,/INSERT OR IGNORE INTO tech_catalog/);
});

test("módulo de guerra usa a identidade autenticada e valida tropas do catálogo permanente", async () => {
 const source=await read("rally.js");
 for(const marker of ["kingdomForPlayer","alliance_members","army_units","json_each","resource_ledger","processDueRallies","occupied_by"])
  assert.ok(source.includes(marker), "missing rally security or economy marker: "+marker);
 assert.match(source,/MAX_TOTAL_TROOPS/);
 assert.match(source,/Object\.hasOwn\(UNIT_POWER/);
 assert.doesNotMatch(source,/apiFetch|window\.map3d/);
});

test("world map oferece painel e ativos PWA do sistema de guerra", async () => {
 const html=await read("world.html");
 const worker=await read("worker.js");
 const sw=await read("sw.js");
 assert.ok(html.includes("/rally-ui.js"));
 assert.ok(html.includes("/styles/rally.css"));
 assert.ok(worker.includes("/api/game/rally/"));
 assert.ok(worker.includes("processDueRallies"));
 assert.ok(sw.includes("/rally-ui.js"));
});
