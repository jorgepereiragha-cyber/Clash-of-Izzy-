import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import { handlePlayerAccountRoute } from "../player-accounts.js";

test("GET /api/account/status returns a masked email and never the stored address", async () => {
  const storedEmail = "comandante.privado@example.com";
  const env = {
    DB: {
      prepare(query) {
        assert.match(query, /SELECT a\.username,a\.email,a\.created_at|SELECT l\.linked_at/);
        return {
          bind(playerId) {
            assert.equal(playerId, "player-status-001");
            return { first: async () => query.includes("google_account_links") ? null : ({
              username: "ComandanteTeste",
              email: storedEmail,
              created_at: "2026-11-17 12:00:00"
            }) };
          }
        };
      }
    },
    SESSION_SECRET: "test-only-session-secret"
  };
  const ctx = {
    gameIdentity: async request => {
      assert.equal(request.headers.get("authorization"), "Bearer test-session");
      return "player-status-001";
    },
    json: (body, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    })
  };
  const request = new Request("https://clash-of-izzy.example.workers.dev/api/account/status", {
    method: "GET",
    headers: { authorization: "Bearer test-session" }
  });

  const response = await handlePlayerAccountRoute(request, env, ctx);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    hasAccount: true,
    googleLinked: false,
    account: {
      username: "ComandanteTeste",
      emailMasked: "c***@example.com",
      created_at: "2026-11-17 12:00:00",
      googleLinked: false
    }
  });
  assert.equal(Object.hasOwn(body.account, "email"), false);
  assert.equal(JSON.stringify(body).includes(storedEmail), false);
});

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
