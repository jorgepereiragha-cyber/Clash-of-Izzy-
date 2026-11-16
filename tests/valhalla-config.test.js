import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeValhallaConfigRows,
  scaleValhallaDurationSeconds,
} from "../valhalla-config.js";

const rows = [
  { key: "valhalla_mode_active", value: "1" },
  { key: "valhalla_resource_multiplier", value: "5.0" },
  { key: "valhalla_speed_multiplier", value: "0.2" },
  { key: "valhalla_start_time", value: "0" },
  { key: "valhalla_end_time", value: "0" },
  { key: "valhalla_daily_runes_reward", value: "100" },
];

test("Valhalla config keeps the deployed defaults visible while inactive", () => {
  const config = normalizeValhallaConfigRows([
    ...rows.filter(row => row.key !== "valhalla_mode_active"),
    { key: "valhalla_mode_active", value: "0" },
  ]);
  assert.equal(config.active, false);
  assert.equal(config.resourceMultiplier, 5);
  assert.equal(config.speedMultiplier, 0.2);
  assert.equal(config.dailyRunesReward, 100);
});

test("Valhalla is active only inside its configured start/end window", () => {
  const now = 2_000_000_000_000;
  const active = normalizeValhallaConfigRows([
    ...rows,
    { key: "valhalla_start_time", value: String(Math.floor(now / 1000) - 10) },
    { key: "valhalla_end_time", value: String(Math.floor(now / 1000) + 10) },
  ], now);
  assert.equal(active.active, true);
  const expired = normalizeValhallaConfigRows([
    ...rows,
    { key: "valhalla_end_time", value: String(Math.floor(now / 1000)) },
  ], now);
  assert.equal(expired.active, false);
});

test("season multipliers are bounded and queue acceleration keeps a safe 10-second floor", () => {
  const active = normalizeValhallaConfigRows(rows);
  assert.equal(scaleValhallaDurationSeconds(60, { active: active.active, speed: active.speedMultiplier }), 12);
  assert.equal(scaleValhallaDurationSeconds(180, { active: true, speed: 0.2 }), 36);
  assert.equal(scaleValhallaDurationSeconds(15, { active: true, speed: 0.2 }), 10);
  assert.equal(scaleValhallaDurationSeconds(60, { active: false, speed: 0.2 }), 60);

  const bounded = normalizeValhallaConfigRows([
    ...rows,
    { key: "valhalla_resource_multiplier", value: "999" },
    { key: "valhalla_speed_multiplier", value: "0" },
  ]);
  assert.equal(bounded.resourceMultiplier, 20);
  assert.equal(bounded.speedMultiplier, 0.05);
});
