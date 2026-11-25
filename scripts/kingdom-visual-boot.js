// Lightweight bootstrap: the 2D preference avoids downloading the Three.js engine.
import {
  GRAPHICS_STORAGE_KEY, normalizeGraphicsChoice, readGraphicsChoice,
  persistGraphicsChoice, graphicsChoiceLabel, getGraphicsStorage
} from "./kingdom-visual-preferences.js";

const select = document.getElementById("coiGraphicsPreset");
const applyButton = document.getElementById("coiGraphicsApply");
const status = document.getElementById("coiGraphicsStatus");
const saved = readGraphicsChoice(getGraphicsStorage(window));
const announce = message => { if (status) status.textContent = message; };
let retryAvailable = false;
const updateApply = () => {
  if (applyButton) applyButton.disabled = normalizeGraphicsChoice(select?.value) === saved && !retryAvailable;
};
const announceFallback = message => {
  retryAvailable = saved !== "2d";
  updateApply();
  announce(message + (retryAvailable ? " Toque em Aplicar para tentar novamente." : ""));
};

if (select) select.value = saved;
if (applyButton) applyButton.disabled = true;

select?.addEventListener("change", () => {
  updateApply();
  announce(normalizeGraphicsChoice(select.value) === saved
    ? (retryAvailable ? "Toque em Aplicar para tentar o 3D novamente." : "Perfil " + graphicsChoiceLabel(saved) + " selecionado.")
    : "Toque em Aplicar para recarregar somente a visualização do reino.");
});

applyButton?.addEventListener("click", () => {
  const value = normalizeGraphicsChoice(select?.value);
  if (value === saved && !retryAvailable) return;
  if (value !== saved && !persistGraphicsChoice(getGraphicsStorage(window), value)) {
    announce("Não foi possível salvar sua preferência neste dispositivo.");
    return;
  }
  announce("Aplicando perfil " + graphicsChoiceLabel(value) + "…");
  window.location.reload();
});

window.addEventListener("coi:kingdom-2d-fallback", () => {
  announceFallback("Modo 2D ativo: WebGL indisponível. Os controles do reino continuam funcionando.");
});

if (saved === "2d") {
  window.__coiKingdomQuality = Object.freeze({ tier: "2d", mode: "2d", dataSaver: true });
  announce("Modo 2D leve: sem renderização 3D; menor uso da GPU e da bateria.");
} else if (!("WebGLRenderingContext" in window)) {
  announceFallback("GPU/WebGL indisponível: mantendo a cidade em 2D.");
} else {
  announce("Preparando cenário 3D · perfil " + graphicsChoiceLabel(saved) + "…");
  try {
    await import("./kingdom-3d.js");
    const info = window.__coiKingdomDiagnostics?.();
    if (info?.available) {
      const tier = graphicsChoiceLabel(info.tier);
      announce("3D ativo · " + tier + " · " + (info.shadows ? "sombras" : "sem sombras") +
        " · resolução adaptada");
    } else {
      announceFallback("Cenário em 2D: seu aparelho preservou a interface jogável.");
    }
  } catch (error) {
    announceFallback("Motor 3D indisponível. Arte 2D mantida; tente o modo Economia.");
    console.warn("Clash of Izzy: inicialização 3D falhou; cena 2D preservada.", error);
  }
}
