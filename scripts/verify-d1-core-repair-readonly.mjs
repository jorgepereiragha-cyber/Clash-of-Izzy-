// Strict read-only proof of the D1 core recovery. No SQL DDL/DML, no restore, no deploy.
// Use only after the manually approved production repair, or in a manual diagnostic.
import { readdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_D1_ID = "7e63af59-d9ff-4159-a9cf-b02e35b92605";
export const CORE_MIGRATIONS = Object.freeze([
  "0037_daily_login_rewards.sql",
  "0038_onboarding_bonus.sql",
  "0039_support_orders.sql"
]);
const REQUIRED_TABLES = Object.freeze([
  "players", "daily_reward_claims", "onboarding_bonus_claims", "support_orders"
]);
const REQUIRED_INDEXES = Object.freeze([
  "idx_daily_reward_claims_latest", "idx_support_orders_paid"
]);

export const READ_ONLY_SQL = Object.freeze({
  history: "SELECT name FROM d1_migrations ORDER BY id",
  tables: "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('players','daily_reward_claims','onboarding_bonus_claims','support_orders')",
  indexes: "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_daily_reward_claims_latest','idx_support_orders_paid')",
  integrity: "PRAGMA foreign_key_check"
});

export function canonicalBaseline(files) {
  if (!Array.isArray(files)) throw Error("Missing canonical migration files.");
  const baseline = files.filter(name => /^00[0-9]{2}_.+\.sql$/.test(name) &&
    Number(name.slice(0, 4)) <= 36).sort();
  if (baseline.length !== 39 || new Set(baseline).size !== baseline.length ||
    baseline.at(-1) !== "0036_4x_read_indexes.sql") {
    throw Error("Canonical migration baseline is not the expected 39 files through 0036.");
  }
  return baseline;
}

function exactSet(actual, expected, label) {
  if (!Array.isArray(actual) || actual.some(name => typeof name !== "string") ||
    actual.length !== expected.length ||
    new Set(actual).size !== actual.length ||
    expected.some(name => !actual.includes(name))) {
    throw Error(label + " does not match the approved production core repair.");
  }
}

export function verifyCoreRepairSnapshot({ history, tables, indexes, foreignKeyViolations, migrationFiles }) {
  const baseline = canonicalBaseline(migrationFiles);
  if (!Array.isArray(history) || history.length !== baseline.length + CORE_MIGRATIONS.length) {
    throw Error("D1 production migration count must be exactly 42 after core repair.");
  }
  exactSet(history.slice(0, baseline.length), baseline, "Historical migrations");
  if (CORE_MIGRATIONS.some((name, i) => history[baseline.length + i] !== name)) {
    throw Error("Core migrations 0037-0039 must be the final three ledger entries in order.");
  }
  exactSet(tables, REQUIRED_TABLES, "Required D1 tables");
  exactSet(indexes, REQUIRED_INDEXES, "Required D1 indexes");
  if (!Array.isArray(foreignKeyViolations) || foreignKeyViolations.length) {
    throw Error("D1 foreign-key integrity not proven after repair.");
  }
  return {
    status: "core-repair-verified-read-only",
    baselineHistoryCount: baseline.length,
    resultingHistoryCount: history.length,
    essentialMigrations: [...CORE_MIGRATIONS],
    requiredTableCount: REQUIRED_TABLES.length,
    requiredIndexCount: REQUIRED_INDEXES.length,
    foreignKeyViolations: 0,
    productionWritesPerformed: 0,
    commercialMigrationsDetected: false
  };
}

function normalizeToken(raw) {
  let token = String(raw || "").trim();
  if (token.toLowerCase().startsWith("bearer ")) token = token.slice(7).trim();
  if (token.length > 1 && token[0] === token[token.length - 1] && ["'", '"'].includes(token[0]))
    token = token.slice(1, -1).trim();
  if (!token || /\s/.test(token)) throw Error("Cloudflare credentials not available for read-only D1 audit.");
  return token;
}

export async function auditProductionCore({
  fetchImpl = fetch, token, accountId, migrationFiles, timeoutMs = 20_000
}) {
  const account = String(accountId || "").trim();
  if (!/^[a-fA-F0-9]{32}$/.test(account)) throw Error("Cloudflare account ID missing or invalid.");
  const secret = normalizeToken(token);
  const endpoint = "https://api.cloudflare.com/client/v4/accounts/" +
    account + "/d1/database/" + PRODUCTION_D1_ID + "/query";
  const files = migrationFiles ?? await readdir(resolve(
    dirname(fileURLToPath(import.meta.url)), "..", "migrations"));
  // Verify repository baseline locally before even querying remote data.
  canonicalBaseline(files);
  const allowed = new Set(Object.values(READ_ONLY_SQL));
  const readOnly = async sql => {
    if (!allowed.has(sql) || (!sql.startsWith("SELECT ") && sql !== "PRAGMA foreign_key_check"))
      throw Error("Only approved read-only D1 audit statements are allowed.");
    const response = await fetchImpl(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" },
      body: JSON.stringify({ sql })
    });
    if (!response || response.status !== 200) throw Error("Cloudflare D1 audit query failed.");
    const payload = await response.json().catch(() => null);
    if (payload?.success !== true || !Array.isArray(payload.result) ||
      payload.result.length !== 1 || payload.result[0]?.success === false ||
      !Array.isArray(payload.result[0]?.results)) {
      throw Error("Cloudflare D1 returned an invalid read-only audit result.");
    }
    return payload.result[0].results;
  };
  const history = (await readOnly(READ_ONLY_SQL.history)).map(row => row.name);
  const tables = (await readOnly(READ_ONLY_SQL.tables)).map(row => row.name);
  const indexes = (await readOnly(READ_ONLY_SQL.indexes)).map(row => row.name);
  const foreignKeyViolations = await readOnly(READ_ONLY_SQL.integrity);
  return verifyCoreRepairSnapshot({ history, tables, indexes, foreignKeyViolations, migrationFiles: files });
}

async function main() {
  const report = await auditProductionCore({
    token: process.env.CLOUDFLARE_API_TOKEN,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID
  });
  console.log("COI_D1_CORE_POST_REPAIR=" + JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      "## D1 production core — verified read-only\n" +
      "- 42/42 migration names through 0039, last 3 in order\n" +
      "- Three core tables, required indexes and foreign keys: verified\n" +
      "- Commercial migrations: none; no production writes from this audit\n");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error("D1 core post-repair audit blocked: " + String(error?.message || error));
    process.exitCode = 1;
  });
}
