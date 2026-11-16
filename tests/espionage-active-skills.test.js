import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const migration = await readFile(new URL("../migrations/0023_espionage_hero_active_skills.sql", import.meta.url), "utf8");
const worker = await readFile(new URL("../worker.js", import.meta.url), "utf8");
const skills = await readFile(new URL("../hero-active-skills.js", import.meta.url), "utf8");
const world = await readFile(new URL("../world-map.js", import.meta.url), "utf8");
const html = await readFile(new URL("../world.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("0023 is additive and persists private spy reports and per-hero cooldowns", () => {
  assert.match(migration, /ALTER TABLE marches ADD COLUMN hero_key TEXT/);
  assert.match(migration, /ALTER TABLE marches ADD COLUMN hero_skill_key TEXT/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS spy_reports/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS hero_skill_cooldowns/);
  assert.match(migration, /march_id INTEGER NOT NULL UNIQUE REFERENCES marches\(id\) ON DELETE CASCADE/);
  assert.match(migration, /report_json TEXT NOT NULL CHECK \(json_valid\(report_json\)\)/);
  assert.match(migration, /PRIMARY KEY \(kingdom_id, hero_key\)/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(migration, /ALTER TABLE players/i);
});

test("enemy scouting creates an owner-scoped expiring report without enabling PvP", () => {
  assert.match(worker, /marchType==="attack"&&target\.owner_kingdom_id/);
  assert.match(worker, /marchType==="gather"&&target\.owner_kingdom_id/);
  assert.match(worker, /INSERT INTO spy_reports\(kingdom_id,target_kingdom_id,target_territory_id,march_id,report_json,created_at,expires_at\)/);
  assert.match(worker, /FROM spy_reports WHERE kingdom_id=\? AND expires_at>\?/);
  assert.match(worker, /espionage_report_ready/);
  assert.match(world, /function renderSpyReports\(\)/);
  assert.match(html, /id="spyReports"/);
});

test("active skills are server-authoritative, owned-hero restricted and cooldown protected", () => {
  for (const key of ["kael_sunwarden", "soldado_basico", "rei_artur", "merlin_arquimago", "odin_awakened", "thor_ragnarok", "freya_vanir", "loki_chaos", "valhalla_king"]) {
    assert.ok(skills.includes(key), "active skill missing for " + key);
  }
  assert.match(worker, /getHeroActiveSkill\(heroKey\)/);
  assert.match(worker, /SELECT 1 AS owned FROM hero_inventory WHERE kingdom_id=\? AND hero_key=\?/);
  assert.match(worker, /hero_skill_cooldowns WHERE kingdom_id=\? AND hero_key=\?/);
  assert.match(worker, /Habilidade em recarga/);
  assert.match(worker, /INSERT INTO hero_skill_cooldowns/);
  assert.match(worker, /hero_skill_activated/);
  assert.match(world, /heroSkillKey/);
  assert.match(html, /id="heroSkillSelection"/);
});

test("map displays reports with text nodes and PWA shell version is refreshed", () => {
  assert.ok(!world.includes("innerHTML"), "untrusted report data must not be injected as HTML");
  assert.match(world, /textContent/);
  assert.match(serviceWorker, /clash-of-izzy-shell-v18/);
});

test("worker, skill catalog and map scripts pass Node syntax checks", () => {
  for (const relativePath of ["../worker.js", "../hero-active-skills.js", "../world-map.js"]) {
    const target = fileURLToPath(new URL(relativePath, import.meta.url));
    const result = spawnSync(process.execPath, ["--check", target], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout || ("Syntax error in " + relativePath));
  }
});
