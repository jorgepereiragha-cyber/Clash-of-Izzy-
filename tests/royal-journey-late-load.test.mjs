import test from "node:test";
import assert from "node:assert/strict";

// A delayed module evaluation must replay the most recent server-backed state
// rather than leaving the command panels stuck on "Sincronizando".
test("royal journey and command HUD recover an event sent before module load", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const ids = [
    "coiJourneyTitle", "coiJourneyMessage", "coiJourneyAction",
    "coiHudCastle", "coiHudPower", "coiHudArmy",
    "coiHudOrderLabel", "coiHudOrderLink"
  ];
  const elements = new Map(ids.map(id => [id, { textContent: "", href: "", dataset: {} }]));
  const listeners = new Map();
  const first = {
    kingdom: { castle_level: 2, power: 550 },
    armyCount: 12,
    troopCapacity: 300,
    queues: [{ queue_type: "training", target_key: "militia", status: "running" }],
    marches: []
  };

  try {
    globalThis.document = { getElementById: id => elements.get(id) || null };
    globalThis.window = {
      __coiCommandSnapshot: first,
      addEventListener(name, listener) {
        listeners.set(name, [...(listeners.get(name) || []), listener]);
      }
    };

    // Recreates the race: kingdom emitted state before either module imported.
    await import("../scripts/royal-journey.js");
    await import("../scripts/kingdom-command-hud.js");
    assert.equal(elements.get("coiJourneyTitle").textContent, "Fortaleça seu castelo");
    assert.equal(elements.get("coiJourneyAction").href, "#buildings");
    assert.equal(elements.get("coiJourneyAction").dataset.phase, "castle");
    assert.equal(elements.get("coiHudCastle").textContent, "Nível 2");
    assert.equal(elements.get("coiHudPower").textContent, "550");
    assert.equal(elements.get("coiHudArmy").textContent, "12 / 300");

    const updates = listeners.get("coi:command-state") || [];
    assert.equal(updates.length, 2, "both modules should keep listening to future updates");
    const next = {
      kingdom: { castle_level: 8, power: 650 },
      armyCount: 40,
      troopCapacity: 300,
      queues: [],
      marches: [{ status: "marching" }]
    };
    for (const handler of updates) handler({ detail: next });
    assert.equal(elements.get("coiJourneyTitle").textContent, "Organize sua aliança");
    assert.equal(elements.get("coiJourneyAction").href, "/alliance.html");
    assert.equal(elements.get("coiHudPower").textContent, "650");
    assert.equal(elements.get("coiHudOrderLabel").textContent,
      "Sem ordens em andamento. Planeje a próxima melhoria do reino.");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
