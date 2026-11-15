import test from "node:test";
import assert from "node:assert/strict";
import { validateStoryStep } from "../story-engine.js";

test("A Primeira Fenda exige Castelo nível 3", () => {
  const result = validateStoryStep({ campaign: "first_rift", step: "offerings", castleLevel: 2 });
  assert.equal(result.ok, false);
  assert.match(result.error, /Castelo nível 3/);
});

test("capítulos só avançam depois do anterior", () => {
  assert.equal(validateStoryStep({ campaign: "first_rift", step: "field", castleLevel: 3 }).ok, false);
  assert.equal(validateStoryStep({ campaign: "first_rift", step: "field", castleLevel: 3, completed: new Set(["offerings"]) }).ok, true);
});

test("Basilisco e tecnologia exigem os capítulos e descobertas anteriores", () => {
  const before = new Set(["offerings", "field"]);
  assert.equal(validateStoryStep({ campaign: "first_rift", step: "basilisk", castleLevel: 3, completed: before }).ok, false);
  const after = new Set(["offerings", "field", "mark"]);
  assert.equal(validateStoryStep({ campaign: "first_rift", step: "basilisk", castleLevel: 3, completed: after }).ok, true);
  assert.equal(validateStoryStep({ campaign: "first_rift", step: "foundations", castleLevel: 3, completed: new Set([...after, "basilisk"]) }).ok, true);
});

test("Arquivo Velado tem sequência própria e não aceita chaves inventadas", () => {
  assert.equal(validateStoryStep({ campaign: "veil_archive", step: "star", castleLevel: 1 }).ok, false);
  assert.equal(validateStoryStep({ campaign: "veil_archive", step: "star", castleLevel: 1, completed: new Set(["lens"]) }).ok, true);
  assert.equal(validateStoryStep({ campaign: "unknown", step: "lens", castleLevel: 30 }).ok, false);
});
