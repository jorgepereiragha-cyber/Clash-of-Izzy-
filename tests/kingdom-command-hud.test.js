import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { summarizeKingdomCommand } from "../scripts/kingdom-command-state.js";

const html = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/kingdom-4x-command.css", import.meta.url), "utf8");
const hud = await readFile(new URL("../scripts/kingdom-command-hud.js", import.meta.url), "utf8");

test("HUD mobile is a discoverable real navigation over existing authenticated screens", () => {
  for (const id of ['id="city"','id="buildings"','id="trainingForm"','id="queues"','id="coiHudPower"']) {
    assert.ok(html.includes(id), "missing " + id);
  }
  assert.match(html, /aria-label="Acesso rápido ao jogo"/);
  assert.match(html, /href="\/world\.html"/);
  assert.match(html, /href="\/alliance\.html"/);
  assert.match(html, /src="\/scripts\/kingdom-command-hud\.js"/);
  assert.match(html, /coi:command-state/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-height:56px/);
  assert.match(hud, /textContent = value/);
  assert.doesNotMatch(hud, /\.innerHTML/);
});
test("projected HUD displays only server-owned state and valid running queues", () => {
  const detail = {
    kingdom: {castle_level:15, power:780123},
    armyCount:430, troopCapacity:1000,
    marches:[{status:"marching"},{status:"traveling"},{status:"home"}],
    queues: [
      {queue_type:"training",target_key:"archer",status:"running",completes_at:"2027-01-02T10:00:00Z"},
      {queue_type:"construction",target_key:"castle",status:"running",completes_at:"2027-01-02T09:00:00Z"},
      {queue_type:"research",target_key:"military",status:"finished",completes_at:"2027-01-01T07:00:00Z"},
      {queue_type:"unknown",target_key:"evil",status:"running"}
    ]
  };
  const view = summarizeKingdomCommand(detail);
  assert.equal(view.power,780123);
  assert.equal(view.castleLevel,15);
  assert.equal(view.armyCount,430);
  assert.equal(view.troopCapacity,1000);
  assert.equal(view.activeMarches,2);
  assert.equal(view.activeOrderCount,2);
  assert.equal(view.nextOrderLabel,"Construção · Castelo");
});
test("untrusted server target is not reflected as markup or fake order", () => {
  const view = summarizeKingdomCommand({queues:[{
    queue_type:"construction",target_key:"<svg onload=alert(1)>",status:"running",completes_at:"2027-01-02T10:00:00Z"
  }]});
  assert.equal(view.nextOrderLabel,"Construção · Ordem em andamento");
  assert.equal(view.power,0);
});
test("CSS keeps the existing Three.js and 2D fallback interactive", () => {
  assert.match(html, /drawKingdomScene\(buildings,Number\(k\.equipped_skin_id\|\|0\)\)/);
  assert.match(html, /city\.querySelectorAll\(":scope > \.building"\)/);
  assert.match(html, /city\.insertAdjacentHTML\("beforeend"/);
  assert.doesNotMatch(html, /city\.append\(kingdom3d\)/);
  assert.match(html, /coi:kingdom-2d-fallback/);
  assert.match(html, /request\("\/game\/state"\)/);
  assert.doesNotMatch(css, /#city\s*\{[^}]*pointer-events:\s*none/);
});
