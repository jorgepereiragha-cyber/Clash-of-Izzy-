import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../.github/workflows/homologar-d1-preview-v0030.yml", import.meta.url),
  "utf8"
);

test("Preview remoto executa somente codigo integrado na main", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /jobs:\s*\n\s*homologar:\s*\n\s*#[^\n]*\n\s*if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test("D1 Preview e isolado de producao e exige base descartavel", () => {
  assert.match(workflow, /6674c0ac-3636-4e57-bff8-23cf60ab9637/);
  assert.match(workflow, /7e63af59-d9ff-4159-a9cf-b02e35b92605/);
  assert.match(workflow, /if names - \{"d1_migrations","_cf_KV"\}:/);
  assert.match(workflow, /d1 migrations apply PREVIEW_DB --remote/);
  assert.doesNotMatch(workflow, /d1 migrations apply clash-of-izzy-db --remote/);
  assert.doesNotMatch(workflow, /wrangler\.jsonc deploy/);
});

test("Homologacao so aprova esquema completo ate 0035", () => {
  for (const migration of [
    "0030_dragons_master_mailbox.sql",
    "0031_entry_package_399.sql",
    "0032_daily_packages.sql",
    "0033_google_account_links.sql",
    "0034_progressive_realms.sql",
    "0035_throne_war.sql"
  ]) assert.ok(workflow.includes(migration), migration);
  for (const table of [
    "kingdom_dragons", "kingdom_mailbox", "master_bonus_claims",
    "google_account_links", "google_auth_challenges",
    "realm_openings", "realm_thrones", "throne_assaults"
  ]) assert.ok(workflow.includes(table), table);
  assert.match(workflow, /\["total"\]\)\s*!=6/);
});

test("Homologacao valida primeiro reino e escudo real de 35 dias", () => {
  assert.match(workflow, /SELECT COUNT\(\*\) FROM realm_openings/);
  assert.match(workflow, /SELECT COUNT\(\*\) FROM realm_thrones/);
  assert.match(workflow, /datetime\(r\.unlocked_at,'\+35 days'\)/);
  assert.match(workflow, /int\(row\["mundos"\]\)!=1 or int\(row\["tronos"\]\)!=1/);
});

test("Preview parcial so avanca de 0030 sem jogadores ou cobrancas", () => {
  assert.match(workflow, /history\[0\]\.get\("name"\)!="0030_dragons_master_mailbox\.sql"/);
  for (const table of ["players", "kingdoms", "player_accounts", "purchase_requests",
    "mercadopago_orders", "world_territories"]) {
    assert.match(workflow, new RegExp("COUNT\\(\\*\\) FROM " + table));
  }
  assert.match(workflow, /any\(int\(value\)!=0 for value in count\.values\(\)\)/);
  assert.match(workflow, /names & forbidden/);
  assert.match(workflow, /0031-0035/);
  assert.match(workflow, /Preview contem jogadores, reinos, territorios ou pagamentos/);
});
