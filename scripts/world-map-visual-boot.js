// Reuse the existing 2D tactical map while heavy Three.js is loaded on demand.
import {readGraphicsChoice, graphicsChoiceLabel} from "./kingdom-visual-preferences.js";

// Accessing localStorage itself may throw (not only getItem).
let choice = "auto";
try { choice = readGraphicsChoice(window.localStorage); } catch { /* Use automatic profile. */ }
const host = document.getElementById("worldMap");
const canvas = document.getElementById("world3d");
const status = document.getElementById("worldGraphicsStatus");
const show = message => { if (status) status.textContent = message; };
const force2D = document.documentElement.classList.contains("force-2d-map");

function useFallback(message) {
  host?.classList.add("map-3d-fallback");
  if (canvas) canvas.hidden = true;
  if (host) host.setAttribute("aria-label", "Mapa estratégico 2D. Arraste para navegar, ajuste o zoom e toque em territórios.");
  show(message);
}

window.addEventListener("coi:world-map-2d-fallback", () => {
  useFallback("Mapa em 2D · falha da GPU; os controles continuam ativos. Recarregue para tentar o 3D novamente.");
});

if (force2D || choice === "2d" || !("WebGLRenderingContext" in window)) {
  useFallback(force2D ? "Mapa em 2D · dispositivo de baixa memória"
    : choice === "2d" ? "Mapa em 2D leve" : "Mapa em 2D · WebGL indisponível");
} else {
  let loading = false;
  let loaded = false;
  async function loadWorld3D() {
    if (loaded || loading || host?.classList.contains("map-3d-fallback")) return;
    loading = true;
    show("Carregando mapa 3D · " + graphicsChoiceLabel(choice) + "…");
    try {
      await import("/world-map-3d.js");
      if (!window.__coiWorldMap3D || host?.classList.contains("map-3d-fallback")) {
        useFallback("Mapa em 2D · proteção da GPU ativada");
        return;
      }
      loaded = true;
      if (canvas) canvas.dataset.loaded = "true";
      show("Mapa 3D · " + graphicsChoiceLabel(window.__coiWorldGraphicsQuality || choice));
    } catch (error) {
      useFallback("Mapa em 2D · motor 3D indisponível");
      console.warn("Clash of Izzy: mapa WebGL indisponível; mantendo marcadores táticos.", error);
    } finally {
      loading = false;
    }
  }

  function deferWorld3D() {
    if (!host) return;
    if (!("IntersectionObserver" in window)) {
      void loadWorld3D();
      return;
    }
    // Defer the GPU renderer until the player can actually see the world map.
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        void loadWorld3D();
      }
    }, { rootMargin: "180px 0px", threshold: 0.01 });
    observer.observe(host);
  }

  if (document.readyState === "complete") deferWorld3D();
  else window.addEventListener("load", deferWorld3D, { once: true });
}
