import test from "node:test";
import assert from "node:assert/strict";
import {
  DUE_MARCH_KINGDOMS_SQL, MAX_DUE_KINGDOMS_PER_TICK,
  MAX_DUE_MARCHES_PER_KINGDOM, resolveDueMarchKingdoms
} from "../march-scheduler-policy.js";

function dbFixture(rows) {
  const called = [];
  return {
    called,
    prepare(sql) {
      assert.equal(sql, DUE_MARCH_KINGDOMS_SQL);
      return { bind(...args) {
        called.push(args);
        return { async all() { return { results: rows }; } };
      } };
    }
  };
}
test("due march scheduler has a fixed bounded budget and database ordering", async () => {
  assert.equal(MAX_DUE_KINGDOMS_PER_TICK, 4);
  assert.equal(MAX_DUE_MARCHES_PER_KINGDOM, 2);
  assert.match(DUE_MARCH_KINGDOMS_SQL, /status='marching'/);
  assert.match(DUE_MARCH_KINGDOMS_SQL, /ORDER BY MIN\(arrives_at\), kingdom_id LIMIT \?/);
  const db = dbFixture([ {kingdom_id:8}, {kingdom_id:3},
    {kingdom_id:19}, {kingdom_id:2}, {kingdom_id:100} ]);
  const resolved = [];
  const now = "2026-11-23T20:30:00.000Z";
  const result = await resolveDueMarchKingdoms({
    db, now, realmLimit:1000, marchLimit:2000,
    resolveKingdom: async (id, limit) => { resolved.push([id, limit]); }
  });
  assert.deepEqual(db.called[0], [now, 4]);
  assert.deepEqual(resolved, [[8,2],[3,2],[19,2],[2,2]]);
  assert.deepEqual(result, {selected:4, completed:4, failed:0});
});
test("failed realm does not prevent other march settlements", async () => {
  const db = dbFixture([{kingdom_id:1},{kingdom_id:2},{kingdom_id:3}]);
  const calls = [], failures = [];
  const result = await resolveDueMarchKingdoms({
    db, now:"2026-11-23T20:31:00.000Z",
    resolveKingdom:async (id, limit) => {
      calls.push([id,limit]);
      if(id === 2) throw new Error("realm 2 D1 error");
    },
    onFailure:(id,error)=>failures.push([id,error.message])
  });
  assert.deepEqual(calls, [[1,2],[2,2],[3,2]]);
  assert.deepEqual(failures, [[2,"realm 2 D1 error"]]);
  assert.deepEqual(result, {selected:3,completed:2,failed:1});
});
test("malformed realm IDs are skipped; no calls run without DB", async () => {
  const db = dbFixture([{kingdom_id:-1},{kingdom_id:"NaN"},{kingdom_id:5}]);
  const calls=[],errors=[];
  const res = await resolveDueMarchKingdoms({db,resolveKingdom: async id=>calls.push(id),
    onFailure:id=>errors.push(id)});
  assert.deepEqual(calls,[5]);
  assert.deepEqual(errors,[-1,"NaN"]);
  assert.deepEqual(res,{selected:3,completed:1,failed:2});
  await assert.rejects(resolveDueMarchKingdoms({resolveKingdom:async()=>{}}), /Missing scheduler/);
});

test("diagnostic callback errors never starve later realms", async () => {
  const db = dbFixture([{kingdom_id:-1},{kingdom_id:1},{kingdom_id:2},{kingdom_id:3}]);
  const settled = [];
  const result = await resolveDueMarchKingdoms({
    db, now:"2026-11-23T20:40:00.000Z",
    resolveKingdom:async id => {
      settled.push(id);
      if(id===1) throw new Error("settlement failure");
    },
    onFailure:async () => { throw new Error("diagnostics unavailable"); }
  });
  assert.deepEqual(settled,[1,2,3]);
  assert.deepEqual(result,{selected:4,completed:2,failed:2});
});

test("production budget of one realm and two marches remains bounded",async()=>{
 const db=dbFixture([{kingdom_id:1},{kingdom_id:2}]);const calls=[];
 const result=await resolveDueMarchKingdoms({db,realmLimit:1,resolveKingdom:async(id,limit)=>calls.push([id,limit])});
 assert.deepEqual(calls,[[1,2]]);assert.equal(db.called[0][1],1);assert.equal(result.selected,1);
});
