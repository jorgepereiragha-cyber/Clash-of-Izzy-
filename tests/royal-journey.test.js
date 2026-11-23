import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectRoyalJourney } from "../scripts/royal-journey-state.js";

const html = readFileSync(new URL("../kingdom.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../scripts/royal-journey.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/royal-journey.css", import.meta.url), "utf8");

test("Jornada do Trono is real, discoverable and accessible on mobile", () => {
  for (const id of ["coiJourneyTitle", "coiJourneyMessage", "coiJourneyAction"]) assert.ok(html.includes('id="' + id + '"'));
  assert.match(html, /src="\/scripts\/royal-journey\.js"/);
  assert.match(html, /href="\/styles\/royal-journey\.css"/);
  assert.match(html, /coi:command-state/);
  assert.match(ui, /\.textContent = next\./);
  assert.doesNotMatch(ui, /\.innerHTML|fetch\(|postMessage\(/);
  assert.match(css, /max-width:600px/);
  assert.match(css, /min-height:48px/);
  for (const path of ["/scripts/royal-journey-state.js", "/scripts/royal-journey.js", "/styles/royal-journey.css"]) {
    assert.ok(sw.includes(path), "precache " + path);
  }
});

test("not synchronized means no misleading progress or fake reward", () => {
  assert.equal(projectRoyalJourney().phase, "sync");
  assert.equal(projectRoyalJourney({kingdom:null}).href, "#city");
});
test("castle guidance uses authoritative level and running queue", () => {
  const current = projectRoyalJourney({kingdom:{castle_level:1}, queues:[]});
  assert.equal(current.href, "#buildings");
  const queued = projectRoyalJourney({kingdom:{castle_level:1}, queues:[
    {queue_type:"construction",target_key:"castle",status:"running"}]});
  assert.equal(queued.href, "#queues");
  assert.equal(queued.phase, "castle-running");
  assert.equal(projectRoyalJourney({kingdom:{castle_level:1}, queues:[
    {queue_type:"construction",target_key:"castle",status:"finished"}]}).href, "#buildings");
});
test("train only when needed and do not treat finished orders as running", () => {
  const k={castle_level:7};
  assert.equal(projectRoyalJourney({kingdom:k,armyCount:0}).href, "#trainingForm");
  assert.equal(projectRoyalJourney({kingdom:k,armyCount:12,queues:[
    {queue_type:"training",status:"running"}]}).href, "#queues");
  assert.equal(projectRoyalJourney({kingdom:k,armyCount:12,queues:[
    {queue_type:"training",status:"completed"}]}).href, "#trainingForm");
});
test("send players to live world and alliance screens, not fictitious PvP", () => {
  const base={kingdom:{castle_level:10},armyCount:30};
  assert.equal(projectRoyalJourney({...base,marches:[{status:"home"}]}).href, "/world.html");
  assert.equal(projectRoyalJourney({...base,marches:[{status:"marching"}]}).href, "/alliance.html");
  assert.equal(projectRoyalJourney({...base,marches:[{status:"traveling"}]}).href, "/alliance.html");
});
test("untrusted values cannot create links, HTML, or rewards", () => {
  const model=projectRoyalJourney({kingdom:{castle_level:8, kingdom_name:'<img src=x onerror=alert(1)>'},armyCount:99999,
    marches:[{status:"marching",url:"javascript:alert(1)"}]});
  assert.equal(model.href,"/alliance.html");
  assert.doesNotMatch(JSON.stringify(model), /onerror|javascript:|gems|recompensa|bonus/i);
});
