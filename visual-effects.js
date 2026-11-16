(() => {
  "use strict";
  if (window.__COI_VFX__) return;
  window.__COI_VFX__ = true;

  const TOKEN_KEY = "coi_game_token";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const defaults = {
    particles_enabled: 1,
    screen_shake_enabled: 1,
    damage_numbers_enabled: 1,
    day_night_cycle_enabled: 1,
    bloom_enabled: 1,
    quality_level: "high"
  };
  let settings = { ...defaults };
  let hour = 12;
  let lastFrame = 0;
  let overlay = null;
  let particleCount = 0;

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }
  function enabled(key) {
    return !reducedMotion && Number(settings[key] ?? defaults[key]) === 1;
  }
  function setSettings(next) {
    if (!next || typeof next !== "object") return;
    settings = { ...settings, ...next };
    document.documentElement.classList.toggle("coi-bloom-enabled", enabled("bloom_enabled"));
    document.documentElement.dataset.coiQuality = String(settings.quality_level || "high");
    updateNightOverlay();
  }
  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement("div");
    overlay.className = "coi-night-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.append(overlay);
    return overlay;
  }
  function updateNightOverlay() {
    if (!enabled("day_night_cycle_enabled")) {
      if (overlay) overlay.style.background = "rgba(8,15,35,0)";
      return;
    }
    const darkness = hour < 5 ? .56 : hour < 7 ? .42 : hour < 9 ? .2 : hour < 17 ? 0 : hour < 19 ? .18 : hour < 21 ? .35 : .56;
    ensureOverlay().style.background = "rgba(8,15,35," + darkness.toFixed(2) + ")";
  }
  function emitDayNight() {
    window.dispatchEvent(new CustomEvent("coi:visuals:day-night", { detail: { hour } }));
    updateNightOverlay();
  }
  function tick(now) {
    if (document.hidden) {
      lastFrame = now;
      return;
    }
    const elapsed = lastFrame ? Math.min(2, Math.max(0, (now - lastFrame) / 1000)) : 0;
    lastFrame = now;
    if (enabled("day_night_cycle_enabled") && elapsed > 0) {
      hour = (hour + elapsed / 600) % 24;
      emitDayNight();
    }
    window.requestAnimationFrame(tick);
  }
  function damageNumber(detail = {}) {
    if (!enabled("damage_numbers_enabled")) return;
    const x = Number.isFinite(Number(detail.x)) ? Number(detail.x) : window.innerWidth / 2;
    const y = Number.isFinite(Number(detail.y)) ? Number(detail.y) : window.innerHeight / 2;
    const value = Math.max(0, Math.floor(Number(detail.amount) || 0));
    const item = document.createElement("span");
    item.className = "coi-damage-number" + (detail.critical ? " critical" : "");
    item.textContent = (detail.critical ? "CRIT! " : "") + value.toLocaleString("pt-BR");
    item.style.left = Math.max(8, Math.min(window.innerWidth - 8, x)) + "px";
    item.style.top = Math.max(8, Math.min(window.innerHeight - 8, y)) + "px";
    item.setAttribute("aria-hidden", "true");
    document.body.append(item);
    item.addEventListener("animationend", () => item.remove(), { once: true });
    window.setTimeout(() => item.remove(), 1400);
  }
  function particleBurst(detail = {}) {
    if (!enabled("particles_enabled") || particleCount >= 140) return;
    const x = Number.isFinite(Number(detail.x)) ? Number(detail.x) : window.innerWidth / 2;
    const y = Number.isFinite(Number(detail.y)) ? Number(detail.y) : window.innerHeight / 2;
    const count = Math.max(4, Math.min(settings.quality_level === "low" ? 8 : 32, Math.floor(Number(detail.count) || 18)));
    const colors = ["#f3c96f", "#ed8b54", "#e8e7dd", "#9c79c8"];
    for (let index = 0; index < count && particleCount < 140; index++) {
      const angle = Math.PI * 2 * index / count + Math.random() * .35;
      const distance = 24 + Math.random() * 58;
      const item = document.createElement("i");
      item.className = "coi-vfx-particle";
      item.style.left = x + "px";
      item.style.top = y + "px";
      item.style.color = colors[index % colors.length];
      item.style.setProperty("--dx", Math.cos(angle) * distance + "px");
      item.style.setProperty("--dy", Math.sin(angle) * distance + "px");
      document.body.append(item);
      particleCount++;
      const remove = () => {
        if (!item.isConnected) return;
        item.remove();
        particleCount = Math.max(0, particleCount - 1);
      };
      item.addEventListener("animationend", remove, { once: true });
      window.setTimeout(remove, 1100);
    }
  }
  function screenShake(detail = {}) {
    if (!enabled("screen_shake_enabled")) return;
    const intensity = Math.max(1, Math.min(4, Number(detail.intensity) || 1));
    const body = document.body;
    body.classList.remove("coi-screen-shake");
    body.style.setProperty("--coi-shake-intensity", intensity + "px");
    void body.offsetWidth;
    body.classList.add("coi-screen-shake");
    window.setTimeout(() => body.classList.remove("coi-screen-shake"), 360);
  }

  window.addEventListener("coi:visuals:update", event => setSettings(event.detail));
  window.addEventListener("coi:vfx:damage", event => damageNumber(event.detail));
  window.addEventListener("coi:vfx:particles", event => particleBurst(event.detail));
  window.addEventListener("coi:vfx:shake", event => screenShake(event.detail));

  window.COIVisualEffects = Object.freeze({
    setSettings,
    damage: detail => window.dispatchEvent(new CustomEvent("coi:vfx:damage", { detail })),
    particles: detail => window.dispatchEvent(new CustomEvent("coi:vfx:particles", { detail })),
    shake: detail => window.dispatchEvent(new CustomEvent("coi:vfx:shake", { detail })),
    getSettings: () => ({ ...settings })
  });

  async function loadSettings() {
    const currentToken = token();
    if (!currentToken) {
      setSettings(defaults);
      return;
    }
    try {
      const response = await fetch("/api/game/advanced/visuals", {
        headers: { Authorization: "Bearer " + currentToken },
        cache: "no-store"
      });
      if (!response.ok) return;
      const data = await response.json();
      setSettings(data.settings || defaults);
    } catch {
      setSettings(defaults);
    }
  }

  function start() {
    setSettings(defaults);
    void loadSettings();
    window.requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        lastFrame = 0;
        emitDayNight();
      }
    });
    emitDayNight();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();