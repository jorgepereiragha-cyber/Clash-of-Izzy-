import test from "node:test";
import assert from "node:assert/strict";
import { DAILY_TASKS, getDailyTasks, claimDailyTask } from "../liveops-engine.js";

function fakeDb({ claimed = [], progress = 1, insertChanges = 1 } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        sql, args: [],
        bind(...args) { this.args = args; return this; },
        async first() { return { value: progress }; },
        async all() { return { results: claimed.map(task_id => ({ task_id })) }; }
      };
    },
    async batch(statements) {
      calls.push(statements);
      return [{ meta: { changes: insertChanges } }, { meta: { changes: insertChanges } }];
    }
  };
}

test("daily task catalog has unique IDs and positive targets", () => {
  const ids = DAILY_TASKS.map(task => task.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const task of DAILY_TASKS) {
    assert.ok(task.target > 0);
    assert.ok(Object.values(task.reward).some(value => value > 0));
  }
});

test("daily task state is server-derived and reports claimed tasks", async () => {
  const DB = fakeDb({ claimed: ["research"], progress: 1 });
  const state = await getDailyTasks({ DB }, 42, new Date("2026-11-14T12:00:00.000Z"));
  assert.equal(state.cycleId, "2026-11-14");
  assert.equal(state.tasks.length, 4);
  assert.equal(state.tasks.find(task => task.id === "research").claimed, true);
  assert.equal(state.tasks.find(task => task.id === "battle").completed, true);
});

test("daily task claim is persisted as a single batch", async () => {
  const DB = fakeDb({ progress: 25 });
  const result = await claimDailyTask({ DB }, 42, "train_troops", new Date("2026-11-14T12:00:00.000Z"));
  assert.equal(result.ok, true);
  assert.equal(result.cycleId, "2026-11-14");
  assert.equal(DB.calls.length, 1);
  assert.ok(DB.calls[0].length >= 4);\n  assert.match(DB.calls[0][2].sql, /credited_at/);\n  assert.ok(DB.calls[0].some(statement => /INSERT INTO resource_ledger/.test(statement.sql)));
});

test("unknown daily task cannot be claimed", async () => {
  const DB = fakeDb();
  const result = await claimDailyTask({ DB }, 42, "not-a-task");
  assert.equal(result.ok, false);
  assert.match(result.error, /inválida/i);
});

test("duplicate daily claim does not credit rewards again", async () => {
  const DB = fakeDb({ progress: 25, insertChanges: 0 });
  const result = await claimDailyTask({ DB }, 42, "train_troops", new Date("2026-11-14T12:00:00.000Z"));
  assert.equal(result.ok, false);
  assert.match(result.error, /já foi resgatada/i);
});
