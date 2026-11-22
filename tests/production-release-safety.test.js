import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("primeiro lançamento exige despacho manual, main e ambiente protegido", async () => {
  const workflow = await read(".github/workflows/primeiro-lancamento-clash-izzy.yml");
  assert.match(workflow, /^on:\s*\n  workflow_dispatch:\s*\n    inputs:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /confirm_production:/);
  assert.match(workflow, /default: false/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main' && inputs\.confirm_production == true/);
  assert.match(workflow, /environment:\s*\n\s+name: production/);
  assert.match(workflow, /gh workflow run deploy-cloudflare\.yml --ref main/);
});

test("bookmark de recuperação D1 não é impresso nem propagado nos outputs", async () => {
  const workflow = await read(".github/workflows/deploy-cloudflare.yml");
  assert.match(workflow, /print\("::add-mask::" \+ bookmark\)/);
  assert.doesNotMatch(workflow, /print\([^\n]*Bookmark:.*bookmark/);
  assert.doesNotMatch(workflow, /output\.write\("bookmark="/);
  assert.match(workflow, /output\.write\("captured=true"/);
  assert.match(workflow, /steps\.capture_d1\.outputs\.captured == 'true'/);
  assert.match(workflow, /clash-of-izzy-d1-pre-migration-restore-point\.json/);
});
