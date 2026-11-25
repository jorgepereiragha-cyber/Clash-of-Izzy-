import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function block(action) {
  const marker = '}else if(type==="'+action+'"){';
  const start = worker.indexOf(marker);
  assert.ok(start >= 0);
  const end = worker.indexOf('}else if(type===', start + marker.length);
  return worker.slice(start, end);
}
function sql(action, prefix) {
  const literals = [...block(action).matchAll(/env\.DB\.prepare\(("(?:[^"\\]|\\.)*")\)\.bind/g)].map(m => JSON.parse(m[1]));
  const query = literals.find(s => s.startsWith(prefix));
  assert.ok(query, action + ": " + prefix);
  return query;
}
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE alliances(id INTEGER PRIMARY KEY, max_members INTEGER, level INTEGER, shared_food INTEGER, shared_wood INTEGER, territory_count INTEGER);
    CREATE TABLE alliance_members(alliance_id INTEGER, kingdom_id INTEGER UNIQUE, role TEXT, rank TEXT, help_count INTEGER DEFAULT 0, help_reset_at TEXT);
    CREATE TABLE alliance_invites(id INTEGER PRIMARY KEY, alliance_id INTEGER, target_kingdom_id INTEGER);
    CREATE TABLE world_territories(id INTEGER PRIMARY KEY, map_region INTEGER, alliance_id INTEGER, territory_key TEXT);
    CREATE TABLE kingdom_events(kingdom_id INTEGER,event_type TEXT,payload_json TEXT);
    INSERT INTO alliances VALUES(1,2,1,5000,5000,0);
    INSERT INTO alliance_members(alliance_id,kingdom_id,role,rank) VALUES(1,10,'leader','lider');
    INSERT INTO alliance_invites VALUES(1,1,11),(2,1,12);
    INSERT INTO world_territories VALUES(7,1,NULL,'forest_east'),(8,1,NULL,'royal_throne_1');
  `);
  return db;
}
function transaction(db, statements) {
  db.exec("BEGIN");
  try {
    const results = statements.map(([query, ...args]) => Number(db.prepare(query).run(...args).changes));
    db.exec("COMMIT");
    return results;
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}

test("alliance invite only consumes an invitation after atomic capacity check", () => {
  const db = fixture();
  try {
    const insert = sql("alliance_accept_invite", "INSERT INTO alliance_members");
    const remove = sql("alliance_accept_invite", "DELETE FROM alliance_invites");
    assert.deepEqual(transaction(db, [[insert,11,1,11,11],[remove,1,11]]),[1,1]);
    assert.deepEqual(transaction(db, [[insert,12,2,12,12],[remove,2,12]]),[0,0]);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM alliance_members").get().n,2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM alliance_invites").get().n,1);
  } finally { db.close(); }
});

test("territory replay, throne and stale rank cannot debit alliance twice", () => {
  const db = fixture();
  try {
    const debit = sql("alliance_claim_territory", "UPDATE alliances SET shared_food");
    const capture = sql("alliance_claim_territory", "UPDATE world_territories");
    const count = sql("alliance_claim_territory", "UPDATE alliances SET territory_count");
    const claim = id => transaction(db, [[debit,1,1,10,id,1],[capture,1,id],[count,1]]);
    assert.deepEqual(claim(7),[1,1,1]);
    assert.deepEqual(claim(7),[0,0,0]);
    assert.deepEqual(claim(8),[0,0,0]);
    db.exec("INSERT INTO world_territories VALUES(9,1,NULL,'forest_west'); UPDATE alliance_members SET rank='membro'");
    assert.deepEqual(claim(9),[0,0,0]);
    const state = db.prepare("SELECT shared_food,shared_wood,territory_count FROM alliances").get();
    assert.deepEqual([state.shared_food,state.shared_wood,state.territory_count],[4000,4000,1]);
  } finally { db.close(); }
});

test("daily alliance help quota is checked against latest persisted counter", () => {
  const db = fixture();
  try {
    db.exec("INSERT INTO alliance_members(alliance_id,kingdom_id,role,rank) VALUES(1,11,'member','membro')");
    const update = sql("alliance_help", "UPDATE alliance_members");
    const event = sql("alliance_help", "INSERT INTO kingdom_events");
    const help = day => transaction(db, [[update,day,day,1,10,day,1,1,11],[event,11,"alliance_help","{}"]]);
    for(let i=0;i<7;i++) assert.deepEqual(help("2026-11-25"),[1,1]);
    assert.deepEqual(help("2026-11-25"),[0,0]);
    assert.deepEqual(help("2026-11-26"),[1,1]);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kingdom_events").get().n,8);
  } finally { db.close(); }
});

test("donation debit, shared credit, contribution and ledger are in one guarded batch", () => {
  const source = block("alliance_donate");
  assert.match(source,/const donation=await env\.DB\.batch\(\[/);
  assert.match(source,/EXISTS\(SELECT 1 FROM alliance_members m JOIN alliances a/);
  assert.match(source,/WHERE id=\? AND changes\(\)=1/);
  assert.match(source,/WHERE alliance_id=\? AND kingdom_id=\? AND changes\(\)=1/);
  assert.match(source,/INSERT INTO resource_ledger\(kingdom_id,resource,amount,reason\) SELECT \?,\?,\?,\? WHERE changes\(\)=1/);
});
