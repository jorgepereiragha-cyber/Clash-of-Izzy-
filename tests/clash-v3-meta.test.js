import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("v3 schema keeps progression kingdom-scoped and preserves existing player identity", async () => {
  const sql = await read("migrations/0022_v3_meta_systems.sql");
  for (const table of [
    "kingdom_visual_settings", "kingdom_vip", "vip_benefits", "kingdom_speedups",
    "daily_tasks", "kingdom_task_progress", "achievement_catalog",
    "kingdom_achievement_progress", "kingdom_mail", "troop_formations",
  ]) {
    assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS " + table), "missing table: " + table);
  }
  assert.ok(sql.includes("kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms(id)"));
  assert.ok(sql.includes("quality_level IN ('low','balanced','high')"));
  assert.ok(sql.includes("queue_type IN ('construction','training','research','march')"));
  assert.ok(sql.includes("weekly_battle_10"));
  assert.ok(sql.includes("strftime('%Y-W%W','now')"));
  assert.ok(!/player_id TEXT[^;]*REFERENCES players\(id\)/.test(sql));
});

test("daily tasks and achievements advance from actual kingdom domain events", async () => {
  const sql = await read("migrations/0022_v3_meta_systems.sql");
  const rally = await read("rally.js");
  const worker = await read("worker.js");
  assert.ok(sql.includes("trg_kingdom_event_meta_progress"));
  assert.ok(sql.includes("trg_battle_report_meta_event"));
  assert.ok(sql.includes("battle_won"));
  assert.ok(rally.includes("resources_gathered"));
  assert.ok(rally.includes('JSON.stringify({nodeId,resource,amount})'));
  assert.ok(worker.includes("building_upgraded"));
  assert.ok(worker.includes("troops_trained"));
  assert.ok(worker.includes("research_upgraded"));
});

test("meta API is mounted below the existing authenticated game router", async () => {
  const worker = await read("worker.js");
  const start = worker.indexOf('const isGamePath=url.pathname.startsWith("/api/game/")');
  const meta = worker.indexOf('url.pathname.startsWith("/api/game/meta/")');
  const auth = worker.indexOf("const playerId=await gameIdentity(request,env)", start);
  assert.ok(start >= 0 && auth > start && meta > auth);
  assert.ok(worker.includes("handleKingdomMeta(request,env,playerId,metaRoute)"));
  assert.ok(worker.includes("kingdom-meta-write-player"));
  assert.ok(worker.includes("request.clone()"));
});

test("claims and speedups use conditional writes instead of client-priced rewards", async () => {
  const source = await read("kingdom-meta.js");
  assert.ok(source.includes("changes()>0"));
  assert.ok(source.includes("completed=1 AND claimed=0"));
  assert.ok(source.includes("function utcWeek"));
  assert.ok(source.includes("dt.period_type"));
  assert.ok(source.includes('queueType === "march"'));
  assert.ok(source.includes('new Set(["construction", "training", "research", "march"])'));
  assert.ok(!source.includes("gems_cost"));
  assert.ok(!source.includes("UPDATE buildings SET upgrade_end_time"));
  assert.ok(!source.includes("request.body.gems_cost"));
});

test("rankings and formations use current kingdom schema and validate ownership", async () => {
  const source = await read("kingdom-meta.js");
  assert.ok(source.includes("k.castle_level"));
  assert.ok(source.includes("p.name"));
  assert.ok(source.includes("player_nicknames"));
  assert.ok(source.includes("heroes WHERE id=? AND kingdom_id=?"));
  assert.ok(source.includes("TROOP_TYPES"));
  assert.ok(!source.includes("p.username"));
  assert.ok(!source.includes("k.level"));
});

test("visual effects reuse the kingdom page and avoid a second Three.js renderer loop", async () => {
  const page = await read("kingdom.html");
  const visual = await read("visual-effects.js");
  const metaUi = await read("kingdom-meta-ui.js");
  const metaCss = await read("styles/kingdom-meta-ui.css");
  const css = await read("styles/visual-effects.css");
  const sw = await read("sw.js");
  assert.ok(page.includes("coi:game-ready"));
  assert.ok(page.includes("coi:game-battle"));
  assert.ok(page.includes("/visual-effects.js"));
  assert.ok(page.includes("/styles/visual-effects.css"));
  assert.ok(page.includes("/kingdom-meta-ui.js"));
  assert.ok(page.includes("/styles/kingdom-meta-ui.css"));
  for (const route of ["tasks/claim","achievements/claim","mail/claim","speedups/use","formations/save","ranking"]) {
    assert.ok(metaUi.includes('api("' + route + '"') || metaUi.includes('api("' + route));
  }
  assert.ok(metaUi.includes("coi-meta-root"));
  assert.ok(metaCss.includes(".coi-meta-grid"));
  assert.ok(visual.includes("cancelAnimationFrame"));
  assert.ok(visual.includes("prefers-reduced-motion"));
  assert.ok(visual.includes("coi:game-battle"));
  assert.ok(css.includes("coi-city-shake"));
  assert.ok(!/from ["']three|new THREE\./.test(visual));
  assert.ok(sw.includes("clash-of-izzy-shell-v19"));
  assert.ok(sw.includes('"/visual-effects.js"'));
  assert.ok(sw.includes('"/kingdom-meta-ui.js"'));
  assert.ok(sw.includes('"/styles/kingdom-meta-ui.css"'));
});

test("PWA installation reuses the existing accessible installer rather than duplicating it", async () => {
  const index = await read("index.html");
  const landing = await read("landing.js");
  const sw = await read("sw.js");
  assert.ok(index.includes('id="install-button"'));
  assert.ok(index.includes('id="install-modal"'));
  assert.ok(index.includes("landing.js"));
  assert.ok(landing.includes("beforeinstallprompt"));
  assert.ok(landing.includes("appinstalled"));
  assert.ok(landing.includes("coi_install_guide_dismissed"));
  assert.ok(!(index + landing + sw).includes("install-enhanced.js"));
});
