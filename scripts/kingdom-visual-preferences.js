// Local-only graphics choice. Never sent to the server or included in game economy.
export const GRAPHICS_STORAGE_KEY = "coi_graphics_preference";
export const GRAPHICS_OPTIONS = Object.freeze(["auto", "low", "balanced", "high", "2d"]);

export function normalizeGraphicsChoice(value) {
  return GRAPHICS_OPTIONS.includes(value) ? value : "auto";
}

export function readGraphicsChoice(storage) {
  try {
    return normalizeGraphicsChoice(storage?.getItem(GRAPHICS_STORAGE_KEY));
  } catch {
    return "auto";
  }
}

export function persistGraphicsChoice(storage, choice) {
  if (!GRAPHICS_OPTIONS.includes(choice)) return false;
  try {
    if (!storage || typeof storage.setItem !== "function") return false;
    storage.setItem(GRAPHICS_STORAGE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}

export function graphicsChoiceLabel(choice) {
  return ({
    auto: "Automático",
    low: "Economia",
    balanced: "Equilibrado",
    high: "Máximo",
    "2d": "2D leve"
  })[normalizeGraphicsChoice(choice)];
}
