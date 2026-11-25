import { summarizeKingdomCommand } from "./kingdom-command-state.js";

const formatter = new Intl.NumberFormat("pt-BR");
const byId = id => document.getElementById(id);
function setText(id, value) {
  const target = byId(id);
  if (target) target.textContent = value;
}

function updateCommandDeck(rawDetail) {
  const view = summarizeKingdomCommand(rawDetail);
  setText("coiHudCastle", "Nível " + formatter.format(view.castleLevel || 1));
  setText("coiHudPower", formatter.format(view.power));
  setText("coiHudArmy", formatter.format(view.armyCount) + " / " + formatter.format(view.troopCapacity));
  if (view.activeOrderCount > 0) {
    const label = view.activeOrderCount === 1 ? "1 ordem em andamento" : formatter.format(view.activeOrderCount) + " ordens em andamento";
    setText("coiHudOrderLabel", label + " · " + view.nextOrderLabel);
    setText("coiHudOrderLink", "Ver ordens");
    const link = byId("coiHudOrderLink");
    if (link) link.href = "#queues";
  } else {
    setText("coiHudOrderLabel", "Sem ordens em andamento. Planeje a próxima melhoria do reino.");
    setText("coiHudOrderLink", "Ver construções");
    const link = byId("coiHudOrderLink");
    if (link) link.href = "#buildings";
  }
}

window.addEventListener("coi:command-state", event => updateCommandDeck(event.detail));
if (window.__coiCommandSnapshot) updateCommandDeck(window.__coiCommandSnapshot);
