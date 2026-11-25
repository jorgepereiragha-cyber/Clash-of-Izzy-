import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { handleDailyReward } from "../daily-rewards.js";

test("daily claim requires a kingdom and credits each UTC day once", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE players(id INTEGER PRIMARY KEY, player_id TEXT UNIQUE, gems INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE kingdoms(id INTEGER PRIMARY KEY, player_id INTEGER UNIQUE REFERENCES players(id),
        wood INTEGER DEFAULT 0, stone INTEGER DEFAULT 0, iron INTEGER DEFAULT 0, updated_at TEXT);
      CREATE TABLE inventory_items(kingdom_id INTEGER REFERENCES kingdoms(id), item_key TEXT,
        quantity INTEGER NOT NULL, PRIMARY KEY(kingdom_id,item_key));
      INSERT INTO players(id,player_id) VALUES(1,'player-a'),(2,'player-b');`);
    db.exec(await readFile(new URL("../migrations/0037_daily_login_rewards.sql",import.meta.url),"utf8"));
    const D1 = {
      prepare(sql) { return { bind(...args) { return {sql,args}; } }; },
      async batch(statements) {
        db.exec("BEGIN");
        try {
          const results = statements.map(({sql,args}) => {
            const stmt = db.prepare(sql);
            if (/^\s*SELECT\b/i.test(sql)) return {results:stmt.all(...args)};
            return {meta:{changes:Number(stmt.run(...args).changes)}};
          });
          db.exec("COMMIT");
          return results;
        } catch(error) { db.exec("ROLLBACK"); throw error; }
      }
    };
    const json = (body,status=200) => ({body,status});
    const call = (method,player="player-a") => handleDailyReward({method},{DB:D1},player,json);
    const gems = id => db.prepare("SELECT gems FROM players WHERE id=?").get(id).gems;
    const claims = id => db.prepare("SELECT COUNT(*) AS n FROM daily_reward_claims WHERE player_id=?").get(id).n;
    assert.equal((await call("GET")).status,404);
    assert.equal((await call("POST")).status,404);
    assert.equal(gems(1),0);
    assert.equal(claims(1),0);
    db.exec("INSERT INTO kingdoms(id,player_id) VALUES(1,1),(2,2)");
    assert.equal((await call("POST")).status,201);
    assert.equal((await call("POST")).status,409);
    assert.equal(gems(1),50);
    assert.equal(claims(1),1);
    db.exec("INSERT INTO daily_reward_claims(player_id,claim_date,cycle_day) VALUES(2,date('now','-1 day'),6)");
    const responses = await Promise.all(Array.from({length:4},()=>call("POST","player-b")));
    assert.equal(responses.filter(r=>r.status===201).length,1);
    assert.equal(responses.filter(r=>r.status===409).length,3);
    assert.equal(gems(2),500);
    assert.equal(claims(2),2);
    assert.equal(db.prepare("SELECT quantity FROM inventory_items WHERE kingdom_id=2 AND item_key='hero_fragment_common'").get().quantity,1);
  } finally { db.close(); }
});
