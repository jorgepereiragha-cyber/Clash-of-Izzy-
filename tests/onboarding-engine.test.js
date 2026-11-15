import test from "node:test";
import assert from "node:assert/strict";
import { buildOnboardingSteps } from "../onboarding-engine.js";

test("novos reinos recebem seis marcos iniciais", () => {
  const steps = buildOnboardingSteps({ buildings: [{ building_type: "castle", level: 1 }], totalTroops: 30 });
  assert.equal(steps.length, 6);
  assert.equal(steps.filter(step => step.done).length, 0);
});

test("marcos refletem o estado existente do servidor", () => {
  const steps = buildOnboardingSteps({
    buildings: [{ building_type: "castle", level: 2 }], totalTroops: 45,
    research: [{ research_key: "economy", level: 1 }], battleReports: [{ id: 1 }],
    alliance: { id: 4 }, storyProgress: [{ campaign_key: "veil_archive", step_key: "lens" }]
  });
  assert.ok(steps.every(step => step.done));
});

test("estado ausente não quebra o guia", () => {
  const steps = buildOnboardingSteps();
  assert.equal(steps.length, 6);
  assert.ok(steps.every(step => !step.done));
});
