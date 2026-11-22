// Read-only Cloudflare D1 Preview readiness audit.
// Only three whitelisted SELECT queries are sent. Never dump player records.
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PREVIEW_ID = "6674c0ac-3636-4e57-bff8-23cf60ab9637";
const PROD_ID = "7e63af59-d9ff-4159-a9cf-b02e35b92605";
const SQL = Object.freeze({
  history: "SELECT name FROM d1_migrations ORDER BY id",
  tables: "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('players','daily_reward_claims','onboarding_bonus_claims','support_orders','kingdom_buildings')",
  count: "SELECT COUNT(*) AS n FROM players"
});
export function normalizeToken(value) {
  let token = String(value || "").trim();
  if (token.toLowerCase().startsWith("bearer ")) token = token.slice(7).trim();
  if (token.length > 1 && token[0] === token[token.length - 1] && ["'", '"'].includes(token[0]))
    token = token.slice(1, -1).trim();
  if (!token || /\s/.test(token)) throw new Error("Cloudflare token unavailable.");
  return token;
}
export function canonicalHistory(files) {
  const expected = files.filter(n => /^00\d{2}_.+\.sql$/.test(n) && Number(n.slice(0,4)) <= 41).sort();
  if (!expected.includes("0041_4x_industries_defenses_progression.sql")) throw new Error("Missing 0041 SQL source.");
  return expected;
}
export async function auditPreview({ fetchImpl, token, accountId, migrationFiles }) {
  const id = String(accountId || "").trim().replace(/^['"]|['"]$/g, "");
  if (!/^[a-fA-F0-9]{32}$/.test(id)) throw new Error("Cloudflare account id unavailable.");
  const normalized = normalizeToken(token);
  if (PREVIEW_ID === PROD_ID) throw new Error("Preview and production must be different.");
  const endpoint = "https://api.cloudflare.com/client/v4/accounts/" + id + "/d1/database/" + PREVIEW_ID + "/query";
  async function readOnly(sql) {
    if (!Object.values(SQL).includes(sql) || !sql.startsWith("SELECT ")) throw new Error("Only approved SELECT statements allowed.");
    const response = await fetchImpl(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { Authorization: "Bearer " + normalized, "Content-Type": "application/json" },
      body: JSON.stringify({sql})
    });
    if (!response.ok) throw new Error("Cloudflare Preview query HTTP " + response.status);
    const payload = await response.json();
    if (payload.success !== true || !Array.isArray(payload.result) ||
        !Array.isArray(payload.result[0]?.results)) throw new Error("Cloudflare Preview query response invalid.");
    return payload.result[0].results;
  }
  const history = (await readOnly(SQL.history)).map(row => row.name);
  const tables = new Set((await readOnly(SQL.tables)).map(row => row.name));
  const expected = canonicalHistory(migrationFiles);
  const historicalMissing = expected.filter(name => !history.includes(name));
  const unexpected = history.filter(name => !expected.includes(name));
  const duplicateNames = history.length !== new Set(history).size;
  const last = history.at(-1) || null;
  const required = ["players","kingdom_buildings","daily_reward_claims","onboarding_bonus_claims","support_orders"];
  const missingTables = required.filter(name => !tables.has(name));
  let playerCount = null;
  if (tables.has("players")) {
    const rows = await readOnly(SQL.count);
    playerCount = rows.length === 1 && Number.isSafeInteger(Number(rows[0]?.n)) ? Number(rows[0].n) : null;
  }
  const ready = history.length === expected.length && historicalMissing.length === 0 &&
    unexpected.length === 0 && !duplicateNames &&
    last === "0041_4x_industries_defenses_progression.sql" &&
    missingTables.length === 0 && playerCount === 0;
  return {
    mode: "read-only", database: "Preview", productionAccess: false, productionWrites: 0,
    latestMigration: last, appliedCount: history.length, expectedThrough0041Count: expected.length,
    missingMigrationFilenames: historicalMissing, unexpectedMigrationFilenames: unexpected,
    duplicateNames, missingRequiredTables: missingTables, playerCount,
    safeToReview4XPreviewSmoke: ready
  };
}
async function main() {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
  const files = await readdir(dir);
  const report = await auditPreview({
    fetchImpl: fetch,
    token: process.env.CLOUDFLARE_API_TOKEN,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    migrationFiles: files
  });
  console.log("COI_D1_PREVIEW_READONLY=" + JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const {appendFile} = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      "## D1 Preview - somente leitura\n" +
      "- Schema 4X completo: " + report.safeToReview4XPreviewSmoke + "\n" +
      "- Ultima migration: " + report.latestMigration + "\n" +
      "- Migrações ausentes: " + report.missingMigrationFilenames.join(", ") + "\n" +
      "- Tabelas ausentes: " + report.missingRequiredTables.join(", ") + "\n" +
      "- Quantidade de jogadores: " + report.playerCount + "\n" +
      "- Nenhuma escrita no banco foi feita.\n");
  }
  if (!report.safeToReview4XPreviewSmoke) process.exitCode = 1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(e => {console.error("Preview not ready: " + e.message);process.exitCode = 1;});
}
