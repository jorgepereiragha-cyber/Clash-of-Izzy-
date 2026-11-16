import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

test("GET /api/account/status is dispatched to the account handler and rejects missing sessions with 401", async () => {
  let databaseTouched = false;
  const env = {
    DB: {
      prepare() {
        databaseTouched = true;
        throw new Error("D1 must not be queried before a session is validated.");
      },
    },
    SESSION_SECRET: "test-only-session-secret",
  };

  const request = new Request("https://clash-of-izzy.example.workers.dev/api/account/status", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const response = await worker.fetch(request, env);
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Sessão do jogador inválida.");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(databaseTouched, false);
});
