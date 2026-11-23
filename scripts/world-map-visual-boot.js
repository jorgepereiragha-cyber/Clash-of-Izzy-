// The page keeps the existing 2D map running while Three.js loads only if needed.
import {readGraphicsChoice, graphicsChoiceLabel} from "./kingdom-visual-preferences.js";
import {shouldForceWorld2D} from "./world-map-performance.js";

const choice = readGraphicsChoice(window.localStorage);
const host = document.getElementById("worldMap");
const canvas = document.getElementById("world3d");
const status = document.getElementById("worldGraphicsStatus");
const show = text => { if (status) status.textContent = text; };
const force2D = shouldForceWorld2D({
  deviceMemory: navigator.deviceMemory,
  hardwareConcurrency: navigator.hardwareConcurrency
});
if (force2D) document.documentElement.classList.add("force-2d-map");

window.addEventListener("coi:quality-downgraded", event => {
  if (!status) return;
  const average = Number(event.detail?.avg);
  show("Qualidade reduzida para melhor desempenho" +
    (Number.isFinite(average) ? " (" + average.toFixed(1) + " FPS)" : ""));
  status.style.color = "#f1c46a";
});

function fallback(reason) {
  host?.classList.add("map-3d-fallback");
  if (canvas) canvas.hidden = true;
  if (host) host.setAttribute("aria-label",
    "Mapa estratégico 2D. Arraste para navegar, ajuste o zoom e toque em territórios.");
  show(reason);
}

if (choice === "2d" || force2D || !("WebGLRenderingContext" in window)) {
  fallback(choice === "2d" ? "Mapa em 2D leve"
    : force2D ? "Mapa em 2D leve · proteção de memória"
    : "Mapa em 2D · WebGL indisponível");
} else {
  let importStarted = false;
  let observer = null;

  async function loadWorld3D() {
    if (importStarted || host?.classList.contains("map-3d-fallback")) return;
    importStarted = true;
    observer?.disconnect();
    observer = null;
    show("Carregando mapa 3D · " + graphicsChoiceLabel(choice) + "…");
    try {
      await import("/world-map-3d.js");
      if (!host?.classList.contains("map-3d-fallback")) {
        if (canvas) canvas.dataset.loaded = "true";
        show("Mapa 3D · " + graphicsChoiceLabel(window.__coiWorldGraphicsQuality || choice));
      } else {
        show("Mapa em 2D · proteção da GPU ativada");
      }
    } catch (error) {
      fallback("Mapa em 2D · motor 3D indisponível");
      console.warn("Clash of Izzy: mapa WebGL indisponível; mantendo marcadores táticos.", error);
    }
  }

  function scheduleWorld3D() {
    if (importStarted || observer || document.hidden || !host) return;
    if (!("IntersectionObserver" in window)) {
      void loadWorld3D();
      return;
    }
    // Defer expensive 3D imports until the user is near the strategy map.
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void loadWorld3D();
    }, { rootMargin: "200px", threshold: 0 });
    observer.observe(host);
  }

  if (document.readyState === "complete") scheduleWorld3D();
  else window.addEventListener("load", scheduleWorld3D, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) scheduleWorld3D();
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) scheduleWorld3D();
  });
}
