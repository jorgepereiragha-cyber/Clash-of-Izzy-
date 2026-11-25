import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../worker.js";

const beta = JSON.parse(readFileSync(new URL("../wrangler.beta.jsonc", import.meta.url), "utf8"));
const production = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));

test("beta scheduler uses isolated D1, no automatic cron before homologation and safe defaults", () => {
  assert.equal(beta.name, "clash-of-izzy-beta");
  assert.equal(beta.vars.ENVIRONMENT, "beta");
  assert.notEqual(beta.d1_databases[0].database_id, production.d1_databases[0].database_id);
  assert.equal(beta.triggers?.crons?.length ?? 0, 0);
  assert.equal(beta.observability.enabled, true);
  assert.equal(beta.vars.INVITE_ONLY, "true");
  assert.equal(beta.vars.GAME_4X_SYSTEMS_ENABLED, "true");
  assert.equal(beta.vars.BETA_LIVE_PAYMENTS_APPROVED, "false");
  assert.equal(beta.vars.BETA_EMAIL_DELIVERY_APPROVED, "false");
});

function emptyDb(queries) {
  return {
    prepare(sql) {
      queries.push(sql);
      const statement = {
        bind() { return statement; },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 0 } }; }
      };
      return statement;
    },
    async batch() { return []; }
  };
}

test("beta scheduler processes due marches but never touches email queue without explicit opt-in", async () => {
  for (const approval of [undefined, "false", "true"]) {
    const queries = [];
    await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 25) }, {
      ENVIRONMENT: "beta",
      BETA_EMAIL_DELIVERY_APPROVED: approval,
      DB: emptyDb(queries),
      RESEND_API_KEY: "synthetic-not-a-real-key",
      EMAIL_FROM: "test@example.invalid"
    });
    assert.ok(queries.some(sql => /FROM marches WHERE status='marching'/.test(sql)));
    assert.equal(queries.some(sql => /UPDATE email_queue SET/.test(sql)), approval === "true");
  }
});
