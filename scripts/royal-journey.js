import { projectRoyalJourney } from "./royal-journey-state.js";

// UI reads only the same server-backed command event already used by the HUD.
const title = document.getElementById("coiJourneyTitle");
const message = document.getElementById("coiJourneyMessage");
const action = document.getElementById("coiJourneyAction");
const allowedLinks = new Set(["#city", "#buildings", "#queues", "#trainingForm", "/world.html", "/alliance.html"]);

if (title && message && action) {
  window.addEventListener("coi:command-state", event => {
    const next = projectRoyalJourney(event.detail);
    title.textContent = next.title;
    message.textContent = next.description;
    action.textContent = next.action;
    // No URL from a player, API response, or external community is followed.
    action.href = allowedLinks.has(next.href) ? next.href : "#city";
    action.dataset.phase = next.phase;
  });
}
