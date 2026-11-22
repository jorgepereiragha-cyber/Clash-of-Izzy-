import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("Sandbox inspection uses the real D1 column owners and public player identity", async () => {
  const [guide, initial, world, orders] = await Promise.all([
    read("docs/4X_SANDBOX_CHECK_SQL.md"),
    read("migrations/0001_init.sql"),
    read("migrations/0002_world.sql"),
    read("migrations/0024_player_accounts_mercadopago_orders.sql")
  ]);

  assert.match(initial, /player_id TEXT NOT NULL UNIQUE/);
  assert.match(world, /player_id INTEGER NOT NULL UNIQUE REFERENCES players\(id\)/);
  assert.match(orders, /ALTER TABLE purchase_requests ADD COLUMN mp_payment_status TEXT/);
  assert.match(orders, /CREATE TABLE IF NOT EXISTS mercadopago_orders/);
  assert.match(orders, /request_id INTEGER NOT NULL UNIQUE REFERENCES purchase_requests\(id\)/);

  const sqlBlock = guide.match(/```sql\n([\s\S]*?)\n```/);
  assert.ok(sqlBlock, "read-only SQL example must be present");
  const query = sqlBlock[1];

  assert.match(query, /^SELECT\s/m);
  assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
  assert.match(query, /r\.mp_payment_status AS recorded_payment_status/);
  assert.match(query, /m\.status AS cached_order_status/);
  assert.doesNotMatch(query, /m\.mp_payment_status/);
  assert.match(query, /p\.id = r\.player_id/);
  assert.match(query, /k\.id = r\.kingdom_id AND k\.player_id = p\.id/);
  assert.match(query, /m\.request_id = r\.id AND m\.order_id = r\.mp_order_id/);
  assert.match(query, /c\.request_id = r\.id AND c\.kingdom_id = k\.id/);
  assert.match(query, /WHERE p\.player_id = 'PUBLIC_PLAYER_ID_DE_TESTE'/);
  assert.match(query, /AND r\.mp_order_id = 'ORDER_MP_DE_TESTE'/);

  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`
      CREATE TABLE players (
        id INTEGER PRIMARY KEY, player_id TEXT UNIQUE, gems INTEGER
      );
      CREATE TABLE kingdoms (
        id INTEGER PRIMARY KEY, player_id INTEGER UNIQUE,
        wood INTEGER, food INTEGER, stone INTEGER, iron INTEGER, gold INTEGER
      );
      CREATE TABLE purchase_requests (
        id INTEGER PRIMARY KEY, player_id INTEGER, kingdom_id INTEGER,
        mp_order_id TEXT, product_name TEXT, price_brl REAL,
        status TEXT, mp_payment_status TEXT
      );
      CREATE TABLE mercadopago_orders (
        order_id TEXT PRIMARY KEY, request_id INTEGER UNIQUE,
        status TEXT, amount_cents INTEGER, fulfilled_at TEXT
      );
      CREATE TABLE level_pack_claims (
        request_id INTEGER PRIMARY KEY, kingdom_id INTEGER,
        pack_level INTEGER, granted_at TEXT, UNIQUE(kingdom_id, pack_level)
      );

      INSERT INTO players VALUES (1, 'PUBLIC_PLAYER_ID_DE_TESTE', 550);
      INSERT INTO players VALUES (2, 'OUTRO_JOGADOR', 0);
      INSERT INTO kingdoms VALUES (7, 1, 10000, 10000, 3000, 1000, 1000);
      INSERT INTO kingdoms VALUES (8, 2, 0, 0, 0, 0, 0);
      INSERT INTO purchase_requests VALUES
        (101, 1, 7, 'ORDER_MP_DE_TESTE', 'Pacote Lord Iniciante', 9.90, 'approved', 'processed'),
        (102, 1, 7, 'OUTRA_ORDER', 'Pacote Senhor Feudal', 29.90, 'pending', 'pending'),
        (103, 2, 8, 'ORDER_TERCEIRO', 'Pacote Lord Iniciante', 9.90, 'approved', 'processed');
      INSERT INTO mercadopago_orders VALUES
        ('ORDER_MP_DE_TESTE', 101, 'processed', 990, '2026-11-22 12:00:00'),
        ('OUTRA_ORDER', 102, 'pending', 2990, NULL),
        ('ORDER_TERCEIRO', 103, 'processed', 990, '2026-11-22 12:00:00');
      INSERT INTO level_pack_claims VALUES
        (101, 7, 10, '2026-11-22 12:00:00');
    `);
    const rows = db.prepare(query).all();
    assert.equal(rows.length, 1, "one public player + one provider order must return one row");
    const [row] = rows;
    assert.equal(row.public_player_id, "PUBLIC_PLAYER_ID_DE_TESTE");
    assert.equal(row.internal_request_id, 101);
    assert.equal(row.mp_order_id, "ORDER_MP_DE_TESTE");
    assert.equal(row.price_brl, 9.9);
    assert.equal(row.request_status, "approved");
    assert.equal(row.recorded_payment_status, "processed");
    assert.equal(row.cached_order_status, "processed");
    assert.equal(row.amount_cents, 990);
    assert.equal(row.pack_level, 10);
    assert.equal(row.gems, 550);
    assert.equal(row.wood, 10000);
    assert.equal(row.food, 10000);
    assert.ok(row.granted_at);
    assert.ok(row.fulfilled_at);
  } finally {
    db.close();
  }
});

test("readiness defaults to main without enabling mutating operations", async () => {
  const workflow = await read(".github/workflows/cloudflare-paid-readiness.yml");
  assert.match(workflow, /target_branch:[\s\S]*?default: main[\s\S]*?type: string/);
  assert.match(workflow, /owner_confirmed_paid_plan:[\s\S]*?default: false[\s\S]*?type: boolean/);
  assert.match(workflow, /d1 migrations list clash-of-izzy-db --remote/);
  assert.match(workflow, /d1 time-travel info clash-of-izzy-db --json/);
  assert.doesNotMatch(workflow, /d1 migrations apply|d1 time-travel restore|gh workflow run deploy-cloudflare/);
  assert.doesNotMatch(workflow, /wrangler[^\n]* deploy(?! --dry-run)/);
});
