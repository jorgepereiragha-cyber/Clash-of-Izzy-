import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("v3 schema keeps progression kingdom-scoped and preserves existing player identity", async () => {
  const sql = await read("migrations/0022_v3_meta_systems.sql");
  for (const table of [
    "kingdom_visual_settings",
    "kingdom_vip",
    "vip_benefits",
    "kingdom_speedups",
    "daily_tasks",
    "kingdom_task_progress",
    "achievement_catalog",
    "kingdom_achievement_progress",
    "kingdom_mail",
    "troop_formations",
  ]) {
    assert.match(sql, new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
  }
  assert.match(sql, /kingdom_id INTEGER PRIMARY KEY REFERENCES kingdoms\\(id\\)/);
  assert.match(sql, /FOREIGN KEY|REFERENCES kingdoms/);
  assert.match(sql, /quality_level IN \\('low','balanced','high'\\)/);
  assert.match(sql, /queue_type IN \\('construction','training','research','march'\\)/);
  assert.doesNotMatch(sql, /player_id TEXT[^;]*REFERENCES players\\(id\\)/);
});

test("daily tasks and achievements advance from actual kingdom domain events", async () => {
  const sql = await read("migrations/0022_v3_meta_systems.sql");
  const rally = await read("rally.js");
  const worker = await read("worker.js");
  assert.match(sql, /trg_kingdom_event_meta_progress/);
  assert.match(sql, /trg_battle_report_meta_event/);
  assert.match(sql, /battle_won/);
  assert.match(rally, /resources_gathered/);
  assert.match(rally, /JSON\\.stringify\\(\\{nodeId,resource,amount\\}\\)/);
  assert.match(worker, /'building_upgraded'/);
  assert.match(worker, /'troops_trained'/);
  assert.match(worker, /'research_upgraded'/);
});

test("meta API is mounted below the existing authenticated game router", async () => {
  const worker = await read("worker.js");
  const start = worker.indexOf('const isGamePath=url.pathname.startsWith("/api/game/")');
  const meta = worker.indexOf('url.pathname.startsWith("/api/game/meta/")');
  const auth = worker.indexOf("const playerId=await gameIdentity(request,env)", start);
  assert.ok(start >= 0 && auth > start && meta > auth);
  assert.match(worker, /handleKingdomMeta\\(request,env,playerId,metaRoute\\)/);
  assert.match(worker, /kingdom-meta-write-player/);
  assert.match(worker, /request\\.clone\\(\\)/);
});

test("claims and speedups use conditional writes instead of client-priced rewards", async () => {
  const module = await read("kingdom-meta.js");
  assert.match(module, /changes\\(\\)>0/);
  assert.match(module, /claimed=1[^"]*completed=1 AND claimed=0/);
  assert.match(module, /queue_type === "march"/);
  assert.match(module, /gems_cost/);
  assert.match(module, /NOT_FOUND|Não foi possível/);
  assert.doesNotMatch(module, /UPDATE buildings SET upgrade_end_time/);
  assert.doesNotMatch(module, /request\\.body\\.gems_cost/);
});

test("rankings and formations use current kingdom schema and validate ownership", async () => {
  const module = await read("kingdom-meta.js");
  assert.match(module, /k\\.castle_level/);
  assert.match(module, /p\\.name/);
  assert.match(module, /player_nicknames/);
  assert.match(module, /heroes WHERE id=\\? AND kingdom_id=\\?/);
  assert.match(module, /TROOP_TYPES/);
  assert.doesNotMatch(module, /p\\.username/);
  assert.doesNotMatch(module, /k\\.level/);
});

test("visual effects reuse the kingdom page and avoid a second Three.js renderer loop", async () => {
  const page = await read("kingdom.html");
  const visual = await read("visual-effects.js");
  const css = await read("styles/visual-effects.css");
  const sw = await read("sw.js");
  assert.match(page, /coi:game-ready/);
  assert.match(page, /coi:game-battle/);
  assert.match(page, /visual-effects\\.js/);
  assert.match(page, /visual-effects\\.css/);
  assert.match(visual, /cancelAnimationFrame/);
  assert.match(visual, /prefers-reduced-motion/);
  assert.match(visual, /coi:game-battle/);
  assert.match(css, /coi-city-shake/);
  assert.doesNotMatch(visual, /from ["']three|new THREE\\./);
  assert.match(sw, /clash-of-izzy-shell-v18/);
  assert.match(sw, /"\\/visual-effects\\.js"/);
});

test("PWA installation reuses the existing accessible installer rather than duplicating it", async () => {
  const index = await read("index.html");
  const landing = await read("landing.js");
  const sw = await read("sw.js");
  assert.match(index, /id="install-button"/);
  assert.match(index, /id="install-modal"/);
  assert.match(index, /landing\\.js/);
  assert.match(landing, /beforeinstallprompt/);
  assert.match(landing, /appinstalled/);
  assert.match(landing, /coi_install_guide_dismissed/);
  assert.doesNotMatch(index + landing + sw, /install-enhanced\\.js/);
});
