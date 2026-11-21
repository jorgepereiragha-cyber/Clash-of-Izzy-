// Shared GPU preference from the Kingdom also applies to the world strategy map.
import {readGraphicsChoice, graphicsChoiceLabel} from "./kingdom-visual-preferences.js";

const choice = readGraphicsChoice(window.localStorage);
const host = document.getElementById("worldMap");
const canvas = document.getElementById("world3d");
const status = document.getElementById("worldGraphicsStatus");
const show = text => { if (status) status.textContent = text; };

if (choice === "2d" || !("WebGLRenderingContext" in window)) {
  host?.classList.add("map-3d-fallback");
  if (canvas) canvas.hidden = true;
  if (host) host.setAttribute("aria-label", "Mapa estratégico 2D. Arraste para navegar, ajuste o zoom e toque em territórios.");
  show(choice === "2d" ? "Mapa em 2D leve" : "Mapa em 2D · WebGL indisponível");
} else {
  show("Carregando mapa 3D · " + graphicsChoiceLabel(choice) + "…");
  try {
    await import("/world-map-3d.js");
    if (!host?.classList.contains("map-3d-fallback")) {
      show("Mapa 3D · " + graphicsChoiceLabel(window.__coiWorldGraphicsQuality || choice));
    } else {
      show("Mapa em 2D · proteção da GPU ativada");
    }
  } catch (error) {
    host?.classList.add("map-3d-fallback");
    if (canvas) canvas.hidden = true;
    show("Mapa em 2D · motor 3D indisponível");
    console.warn("Clash of Izzy: mapa WebGL indisponível; mantendo marcadores táticos.", error);
  }
}
