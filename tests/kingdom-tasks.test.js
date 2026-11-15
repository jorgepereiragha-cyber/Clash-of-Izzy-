import test from "node:test";
import assert from "node:assert/strict";
import { taskDurationSeconds } from "../task-engine.js";

test("construction and research durations grow with level", () => {
  assert.ok(taskDurationSeconds("construction", 2) > taskDurationSeconds("construction", 1));
  assert.ok(taskDurationSeconds("research", 3) > taskDurationSeconds("research", 1));
});

test("training duration scales with quantity and unit complexity", () => {
  assert.ok(taskDurationSeconds("training", 1, 20, "militia") > taskDurationSeconds("training", 1, 10, "militia"));
  assert.ok(taskDurationSeconds("training", 1, 10, "trebuchet") > taskDurationSeconds("training", 1, 10, "militia"));
});

test("durations are positive and capped at one day", () => {
  for (const kind of ["construction", "research", "training"]) {
    const value = taskDurationSeconds(kind, 30, 10000, "trebuchet");
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 5);
    assert.ok(value <= 86400);
  }
});
