import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url),"utf8");

test("retired auto-migration workflow cannot mutate remote Preview from push", async () => {
  const yaml=await read(".github/workflows/4x-preview-migrate.yml");
  assert.match(yaml, /^on:\s*\n  workflow_dispatch:/m);
  assert.doesNotMatch(yaml, /^\s+(?:push|pull_request|workflow_run):/m);
  assert.doesNotMatch(yaml, /d1 migrations apply PREVIEW_DB --remote/);
  assert.match(yaml, /prepare-preview-d1\.yml/);
  assert.match(yaml, /exit 1/);
});

test("remote 4X preview smoke requires explicit disposable-DB and UUID opt-in", async () => {
  const yaml=await read(".github/workflows/4x-preview-http-smoke.yml");
  assert.match(yaml,/^on:\s*\n  workflow_dispatch:\s*\n    inputs:/m);
  assert.doesNotMatch(yaml,/^\s+(?:push|pull_request|workflow_run):/m);
  assert.match(yaml,/confirm_preview_disposable:[\s\S]*?default: false[\s\S]*?type: boolean/);
  assert.match(yaml,/confirm_preview_uuid:[\s\S]*?default: ""[\s\S]*?type: string/);
  assert.match(yaml,/inputs\.confirm_preview_disposable == true/);
  assert.match(yaml,/inputs\.confirm_preview_uuid == '6674c0ac-3636-4e57-bff8-23cf60ab9637'/);
  assert.match(yaml,/test "\$CONFIRM_DISPOSABLE" = "true"/);
  assert.match(yaml,/test "\$CONFIRM_UUID" = "6674c0ac-3636-4e57-bff8-23cf60ab9637"/);
  assert.match(yaml,/wrangler\.4x-smoke\.generated\.jsonc dev --remote/);
  assert.doesNotMatch(yaml,/wrangler --config wrangler\.jsonc dev --remote/);
});
