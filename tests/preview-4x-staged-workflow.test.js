import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const wf=readFileSync(new URL("../.github/workflows/prepare-preview-d1.yml",import.meta.url),"utf8");
const smoke=readFileSync(new URL("../.github/workflows/4x-preview-http-smoke.yml",import.meta.url),"utf8");
const migrationNames=readdirSync(new URL("../migrations/",import.meta.url))
  .filter(name=>/^00[0-9]{2}_.+\.sql$/.test(name)&&Number(name.slice(0,4))<=41).sort();

test("Preview 4X stages exactly migrations through 0041, never commercial 0042-0044",()=>{
  assert.equal(migrationNames.at(-1),"0041_4x_industries_defenses_progression.sql");
  assert.match(wf,/int\(f\.name\[:4\]\)<=41/);
  assert.match(wf,/directory\.name/);
  assert.match(wf,/wrangler\.preview-4x\.generated\.jsonc/);
  assert.match(wf,/history!=staged\[:len\(history\)\]/);
  assert.match(smoke,/0041_4x_industries_defenses_progression\.sql/);
  assert.doesNotMatch(wf,/--config wrangler\.preview-migrations\.jsonc d1 migrations apply/);
});
test("Preview 4X refuses non-disposable or dirty database and protects production",()=>{
  assert.match(wf,/confirm_preview_is_disposable/);
  assert.match(wf,/confirm_apply_preview_migrations/);
  assert.match(wf,/Preview contains rows in/);
  assert.match(wf,/Preview schema\/history diverges/);
  assert.match(wf,/PRAGMA foreign_key_check/);
  assert.match(wf,/preview!=prod/);
  assert.match(wf,/6674c0ac-3636-4e57-bff8-23cf60ab9637/);
  assert.match(wf,/7e63af59-d9ff-4159-a9cf-b02e35b92605/);
  assert.doesNotMatch(wf,/d1 migrations apply clash-of-izzy-db --remote/);
});
