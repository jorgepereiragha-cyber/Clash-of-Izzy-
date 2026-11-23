// Read-only safety gate before deploying or applying migrations to the isolated beta.
// Run node beta/check-isolation.mjs --require-provisioned only AFTER setting a new beta D1 UUID.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER = "REPLACE_WITH_NEW_BETA_D1_UUID";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_DISABLED = [
  "BETA_LIVE_PAYMENTS_APPROVED", "LEVEL_PACKS_ENABLED",
  "LEVEL_PACKS_PUBLIC_ENABLED", "LEVEL_PACKS_PROPOSED_PRICES_APPROVED",
  "MASTER_PACK_ENABLED"
];
const SENSITIVE = /(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY|CREDENTIAL)/i;

export function checkBetaIsolation(beta, production, { requireProvisioned = false } = {}) {
  const errors = [];
  const expect = (ok, message) => { if (!ok) errors.push(message); };
  const prod = production?.d1_databases?.[0];
  const preview = production?.previews?.d1_databases?.[0];
  const db = beta?.d1_databases?.[0];
  const vars = beta?.vars ?? {};
  const uuid = db?.database_id ?? "";
  const configured = UUID.test(uuid) && uuid !== prod?.database_id && uuid !== preview?.database_id;

  expect(production?.name === "clash-of-izzy" && prod?.database_name === "clash-of-izzy-db",
    "A referencia de producao mudou; interrompa a operacao");
  expect(preview?.database_name === "izzy-preview-17112026", "A referencia de Preview mudou");
  expect(UUID.test(prod?.database_id || "") && UUID.test(preview?.database_id || "") &&
    prod.database_id !== preview.database_id, "IDs de producao/Preview invalidos");
  expect(beta?.name === "clash-of-izzy-beta" && beta?.main === "worker.js",
    "Worker beta ou entrypoint incorreto");
  expect(beta?.workers_dev === true, "O dominio de teste workers.dev deve estar habilitado");
  expect(beta?.assets?.directory === "." && beta?.assets?.binding === "ASSETS" &&
    beta?.assets?.run_worker_first === true, "Todos os assets devem atravessar o gate do Worker");
  expect(Array.isArray(beta?.d1_databases) && beta.d1_databases.length === 1 &&
    db?.binding === "DB" && db?.database_name === "clash-of-izzy-beta-db" &&
    db?.migrations_dir === "migrations", "D1 beta ou migrations_dir inesperados");
  expect(uuid === PLACEHOLDER || configured, "UUID D1 invalido ou igual ao banco oficial/Preview");
  if (requireProvisioned) expect(configured, "D1 beta ainda sem UUID exclusivo validado; nao migrar/deploy");
  expect(vars.ENVIRONMENT === "beta" && vars.INVITE_ONLY === "true",
    "ENVIRONMENT/INVITE_ONLY devem fechar o beta por convite");
  expect(vars.GAME_4X_SYSTEMS_ENABLED === "true", "Reutilizacao 4X precisa estar habilitada no beta");
  for (const flag of REQUIRED_DISABLED) {
    expect(vars[flag] === "false", flag + " deve continuar false; sem cobranca real");
  }
  expect(Object.keys(vars).every(key => !SENSITIVE.test(key)),
    "Segredos e tokens nunca devem ficar expostos em vars de Wrangler");
  expect(!beta?.triggers || Object.keys(beta.triggers).length === 0,
    "Nenhum cron deve iniciar no beta antes da homologacao");
  expect(beta?.durable_objects?.bindings?.length === 1 &&
    beta.durable_objects.bindings[0]?.name === "ELDORIA_ROOM" &&
    beta.durable_objects.bindings[0]?.class_name === "EldoriaRoom",
    "Durable Object realtime deve ser distinto pelo Worker beta");
  return { ok: errors.length === 0, configured, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--require-provisioned")) {
    console.error("Uso: node beta/check-isolation.mjs [--require-provisioned]");
    process.exitCode = 2;
  } else {
    const beta = JSON.parse(readFileSync(new URL("../wrangler.beta.jsonc", import.meta.url), "utf8"));
    const prod = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
    const result = checkBetaIsolation(beta, prod, {
      requireProvisioned: args.includes("--require-provisioned")
    });
    if (!result.ok) {
      for (const error of result.errors) console.error("BETA BLOQUEADO: " + error);
      process.exitCode = 1;
    } else {
      console.log(result.configured
        ? "BETA CONFIG OK: UUID distinto de producao/Preview. Ainda exige CI, secrets e schema remoto."
        : "BETA ESQUELETO OK: UUID pendente. Proibido migrar ou fazer deploy.");
    }
  }
}
