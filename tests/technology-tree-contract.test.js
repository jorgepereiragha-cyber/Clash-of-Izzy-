import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration,worker,adapter,kingdom,ui,serviceWorker]=await Promise.all([
  readFile(new URL("../migrations/0022_technology_progression.sql",import.meta.url),"utf8"),
  readFile(new URL("../worker.js",import.meta.url),"utf8"),
  readFile(new URL("../game-adapter.js",import.meta.url),"utf8"),
  readFile(new URL("../kingdom.html",import.meta.url),"utf8"),
  readFile(new URL("../technology-tree.js",import.meta.url),"utf8"),
  readFile(new URL("../sw.js",import.meta.url),"utf8")
]);

test("technology progression migration is additive and backfills each existing kingdom",()=>{
  assert.match(migration,/CREATE INDEX IF NOT EXISTS idx_kingdom_tech_level/);
  assert.match(migration,/INSERT OR IGNORE INTO kingdom_tech/);
  assert.match(migration,/CROSS JOIN tech_catalog/);
  assert.doesNotMatch(migration,/DROP TABLE|DELETE FROM kingdoms|ALTER TABLE kingdoms/i);
});

test("technology research reuses authenticated kingdom actions and persistent queue",()=>{
  assert.match(worker,/type==="technology"/);
  assert.match(worker,/INSERT INTO kingdom_queues/);
  assert.match(worker,/target_key LIKE 'tech:%'/);
  assert.match(worker,/UPDATE kingdom_tech SET level=/);
  assert.match(worker,/calculateTechnologyResearchCost/);
  assert.match(worker,/getKingdomTechnologyBonuses/);
  assert.match(worker,/ensureKingdomTechnologyRows/);
});

test("technology bonuses are fed into combat and the existing march calculation",()=>{
  assert.match(worker,/technologyBonuses,criticalChancePercent/);
  assert.match(worker,/technologyBonuses\.marchSpeedPercent/);
  assert.match(adapter,/technologyBonuses\.infantryAttackPercent/);
  assert.match(adapter,/technologyBonuses\.cavalryAttackPercent/);
  assert.match(adapter,/technologyBonuses\.archerAttackPercent/);
});

test("technology panel uses server state and safe DOM text APIs",()=>{
  assert.match(kingdom,/id="technologyTree"/);
  assert.match(kingdom,/coi:kingdom-technologies/);
  assert.match(kingdom,/technology-tree\.js/);
  assert.match(ui,/fetch\("\/api\/game\/action"/);
  assert.match(ui,/Authorization:\s*"Bearer "\s*\+\s*token/);
  assert.match(ui,/textContent/);
  assert.doesNotMatch(ui,/innerHTML/);
});

test("PWA shell v18 precaches all technology tree assets",()=>{
  assert.match(serviceWorker,/clash-of-izzy-shell-v18/);
  for(const asset of ["/technology-tree.js","/styles/technology-tree.css","/styles/visual-polish.css"]){
    assert.ok(serviceWorker.includes(asset),"missing PWA asset "+asset);
  }
});
