// End-to-end, OFFLINE proof that the production core-repair workflow's
// isolated migration directory applies only 0037-0039 after an existing 0036.
// Never points at a remote D1 database, never imports Cloudflare credentials.
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "migrations");
const wrangler = resolve(root, "node_modules/.bin/wrangler");
const essential = Object.freeze([
  "0037_daily_login_rewards.sql",
  "0038_onboarding_bonus.sql",
  "0039_support_orders.sql",
]);
const databaseId = "00000000-0000-4000-8000-000000000001";
const databaseName = "coi-core-repair-offline-fixture";
const binding = "OFFLINE_DB";

export function checkedCliArgs(args) {
  if (!Array.isArray(args) || !args.includes("--local") ||
      !args.includes("--persist-to") || args.includes("--remote") ||
      args.includes("--preview") || args.some(a => a === "clash-of-izzy-db")) {
    throw new Error("Only isolated local D1 CLI calls are authorized.");
  }
  if (args.includes("deploy") || args.includes("publish") || args.includes("delete")) {
    throw new Error("Remote/deploy commands are forbidden in offline proof.");
  }
  return args;
}

function cli(args) {
  checkedCliArgs(args);
  const result = spawnSync(wrangler, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, CI: "true" }
  });
  if (result.error || result.status !== 0) {
    throw new Error("Offline Wrangler command failed: " +
      (result.error?.message || result.stderr?.slice(-2500) || result.stdout?.slice(-2500)));
  }
  return result.stdout;
}

function resultsFromWrangler(jsonText) {
  const output = JSON.parse(jsonText.trim());
  if (!Array.isArray(output) || !Array.isArray(output[0]?.results) ||
      output[0]?.success !== true) {
    throw new Error("Unexpected Wrangler JSON format; migration proof cannot pass.");
  }
  return output[0].results;
}

export async function prove() {
  const tmp = await mkdtemp(join(tmpdir(), "coi-d1-core-offline-"));
  try {
    const histDir = join(tmp, "history");
    const essentialDir = join(tmp, "essential");
    const storage = join(tmp, "sqlite-storage");
    await Promise.all([mkdir(histDir), mkdir(essentialDir), mkdir(storage)]);
    const all = await readdir(source);
    const baseline = all.filter(n => /^00\d{2}_.+\.sql$/.test(n) &&
      Number(n.slice(0,4)) <= 36).sort();
    assert.equal(baseline.length, 39, "Expected exactly 39 existing migrations through 0036.");
    assert.equal(baseline.at(-1), "0036_4x_read_indexes.sql");
    for (const name of baseline) await copyFile(join(source, name), join(histDir, name));
    for (const name of essential) await copyFile(join(source, name), join(essentialDir, name));
    assert.deepEqual((await readdir(essentialDir)).sort(), essential.slice().sort(),
      "The repair staging directory must not include any historical or commercial SQL.");

    async function config(dir, fileName) {
      const path = join(tmp, fileName);
      await writeFile(path, JSON.stringify({
        d1_databases: [{
          binding,
          database_name: databaseName,
          database_id: databaseId,
          migrations_dir: dir,
        }]
      }));
      return path;
    }

    const initialConfig = await config("history", "initial.jsonc");
    const onlyEssentialConfig = await config("essential", "essential.jsonc");
    const opts = ["--local", "--persist-to", storage];

    cli(["--config", initialConfig, "d1", "migrations", "apply", binding, ...opts]);
    const readSql = (configPath, sql) => resultsFromWrangler(cli([
      "--config", configPath, "d1", "execute", binding, ...opts,
      "--command", sql, "--json"
    ]));

    const before = readSql(initialConfig, "SELECT name FROM d1_migrations ORDER BY id");
    const initialNames = before.map(x => x.name);
    assert.equal(initialNames.length, baseline.length);
    assert.deepEqual(new Set(initialNames), new Set(baseline));
    assert.equal(initialNames.at(-1), "0036_4x_read_indexes.sql");

    // Run the same isolated migration selection used in production repair:
    // the Wrangler config can only see files 0037, 0038, 0039.
    cli(["--config", onlyEssentialConfig, "d1", "migrations", "apply", binding, ...opts]);
    const after = readSql(onlyEssentialConfig, "SELECT name FROM d1_migrations ORDER BY id");
    const appliedNames = after.map(x => x.name);
    assert.equal(appliedNames.length, baseline.length + essential.length);
    assert.deepEqual(new Set(appliedNames), new Set([...baseline, ...essential]));
    assert.deepEqual(appliedNames.slice(-3), essential, "Essential migrations must run in 0037-0039 order.");

    const tables = readSql(onlyEssentialConfig,
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('daily_reward_claims','onboarding_bonus_claims','support_orders','intermediate_resources')");
    assert.deepEqual(new Set(tables.map(x => x.name)),
      new Set(["daily_reward_claims","onboarding_bonus_claims","support_orders"]),
      "Three core tables must exist; the 0041 4X table must not appear.");

    console.log("OFFLINE_D1_CORE_PROOF=" + JSON.stringify({
      remoteAccess: false, existingHistory: initialNames.length,
      appliedEssential: appliedNames.slice(-3), resultingHistory: appliedNames.length,
      coreTablesCreated: tables.map(x => x.name).sort(), commercialMigrationsApplied: 0,
      advanced4XMigrationsApplied: 0
    }));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prove().catch(error => {
    console.error("D1 local-only repair proof failed:", error.message);
    process.exitCode = 1;
  });
}
