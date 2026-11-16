(() => {
  "use strict";

  const host = document.getElementById("city");
  const game = document.getElementById("game");
  if (!host || !game) return;

  const DEFAULTS = Object.freeze({
    particles_enabled: 1,
    screen_shake_enabled: 1,
    damage_numbers_enabled: 1,
    day_night_cycle_enabled: 1,
    quality_level: "balanced",
  });
  const QUALITY_COUNTS = Object.freeze({ low: 18, balanced: 34, high: 58 });
  let settings = { ...DEFAULTS };
  let canvas = null;
  let ctx = null;
  let frame = 0;
  let lastFrame = 0;
  let particles = [];
  let settingsRoot = null;
  let settingsLoaded = false;
  let dayNightTimer = 0;

  function tokenValue() {
    try {
      return localStorage.getItem("coi_game_token") || sessionStorage.getItem("coi_game_token") || "";
    } catch {
      return "";
    }
  }

  function authorizedHeaders(json = false) {
    const headers = {};
    const token = tokenValue();
    if (token) headers.Authorization = "Bearer " + token;
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  function ensureCanvas() {
    if (canvas || !host.isConnected) return;
    canvas = document.createElement("canvas");
    canvas.className = "coi-vfx-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    ctx = canvas.getContext("2d", { alpha: true });
    resizeCanvas();
    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(resizeCanvas);
      observer.observe(host);
      window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
    } else {
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const rect = host.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, settings.quality_level === "high" ? 1.5 : 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function dayPhase(date = new Date()) {
    const hour = date.getHours() + date.getMinutes() / 60;
    if (hour >= 5 && hour < 8) return "dawn";
    if (hour >= 8 && hour < 17) return "day";
    if (hour >= 17 && hour < 20) return "dusk";
    return "night";
  }

  function updateDayNight() {
    host.dataset.dayPhase = settings.day_night_cycle_enabled ? dayPhase() : "day";
    host.classList.toggle("coi-day-cycle", Boolean(settings.day_night_cycle_enabled));
  }

  function stopAnimation() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function scheduleAnimation() {
    if (frame || !particles.length || document.hidden || !settings.particles_enabled) return;
    frame = requestAnimationFrame(drawParticles);
  }

  function spawnBurst(x, y, count, color) {
    if (!settings.particles_enabled || !ctx || !canvas) return;
    const rect = host.getBoundingClientRect();
    const boundedCount = Math.min(count, QUALITY_COUNTS[settings.quality_level] || QUALITY_COUNTS.balanced);
    for (let i = 0; i < boundedCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 130;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        size: 1.5 + Math.random() * 3,
        life: 0.65 + Math.random() * 0.55,
        initialLife: 0.65 + Math.random() * 0.55,
        color,
      });
    }
    if (particles.length > 180) particles.splice(0, particles.length - 180);
    scheduleAnimation();
  }

  function drawParticles(timestamp) {
    frame = 0;
    if (!ctx || !canvas || document.hidden || !settings.particles_enabled) {
      particles = [];
      stopAnimation();
      return;
    }
    const rect = host.getBoundingClientRect();
    const delta = lastFrame ? Math.min(0.04, Math.max(0, (timestamp - lastFrame) / 1000)) : 0.016;
    lastFrame = timestamp;
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= delta;
      if (particle.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      particle.vy += 150 * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      ctx.globalAlpha = Math.max(0, particle.life / particle.initialLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (particles.length) scheduleAnimation();
    else lastFrame = 0;
  }

  function screenShake() {
    if (!settings.screen_shake_enabled || !host.isConnected ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    host.classList.remove("coi-screen-shake");
    void host.offsetWidth;
    host.classList.add("coi-screen-shake");
  }

  function floatingLabel(text, kind = "damage") {
    if (!settings.damage_numbers_enabled || !host.isConnected) return;
    const label = document.createElement("div");
    label.className = "coi-vfx-label coi-vfx-label-" + kind;
    label.textContent = String(text).slice(0, 48);
    host.append(label);
    label.addEventListener("animationend", () => label.remove(), { once: true });
    window.setTimeout(() => label.remove(), 1800);
  }

  function handleBattle(event) {
    const battle = event.detail || {};
    const won = battle.won === true;
    const rect = host.getBoundingClientRect();
    spawnBurst(rect.width / 2, rect.height / 2, won ? 64 : 30, won ? "#ffd36b" : "#e87979");
    if (settings.screen_shake_enabled) screenShake();
    floatingLabel(won ? "VITÓRIA" : "DERROTA", won ? "victory" : "defeat");
    const damage = Number(battle.damage);
    if (Number.isFinite(damage) && damage > 0) {
      floatingLabel((battle.critical ? "CRIT! " : "") + "−" + damage.toLocaleString("pt-BR"), "damage");
    }
  }

  function makeSettingsPanel() {
    if (settingsRoot || !game.isConnected) return;
    settingsRoot = document.createElement("section");
    settingsRoot.className = "panel coi-visual-panel";
    const title = document.createElement("h2");
    title.textContent = "🎨 Preferências visuais";
    const description = document.createElement("p");
    description.className = "muted";
    description.textContent = "Ajuste os efeitos da cidade. O perfil 3D adaptativo continua protegendo o desempenho do aparelho.";
    const grid = document.createElement("div");
    grid.className = "coi-visual-settings-grid";
    settingsRoot.append(title, description, grid);

    const fields = [
      ["particles_enabled", "Partículas e explosões"],
      ["screen_shake_enabled", "Tremor de tela em batalhas"],
      ["damage_numbers_enabled", "Números e avisos flutuantes"],
      ["day_night_cycle_enabled", "Ciclo visual de dia e noite"],
    ];
    for (const [key, labelText] of fields) {
      const label = document.createElement("label");
      label.className = "coi-visual-toggle";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(settings[key]);
      input.dataset.setting = key;
      const text = document.createElement("span");
      text.textContent = labelText;
      input.addEventListener("change", () => updateSetting(key, input.checked ? 1 : 0, input));
      label.append(input, text);
      grid.append(label);
    }

    const qualityLabel = document.createElement("label");
    qualityLabel.className = "coi-visual-quality";
    qualityLabel.textContent = "Intensidade dos efeitos";
    const select = document.createElement("select");
    select.dataset.setting = "quality_level";
    for (const [value, label] of [["low","Leve"],["balanced","Equilibrada"],["high","Alta"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    select.value = settings.quality_level;
    select.addEventListener("change", () => updateSetting("quality_level", select.value, select));
    qualityLabel.append(select);
    grid.append(qualityLabel);

    const status = document.createElement("div");
    status.className = "coi-visual-status muted";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    settingsRoot.append(status);
    game.append(settingsRoot);
  }

  async function updateSetting(key, value, control) {
    const previous = settings[key];
    if (key === "quality_level" && !["low","balanced","high"].includes(value)) return;
    try {
      const response = await fetch("/api/game/meta/visual-settings", {
        method: "PUT",
        headers: authorizedHeaders(true),
        body: JSON.stringify({ [key]: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a preferência.");
      settings = { ...settings, ...data.settings };
      applySettings();
      const status = settingsRoot?.querySelector(".coi-visual-status");
      if (status) status.textContent = "Preferências salvas.";
    } catch (error) {
      settings[key] = previous;
      if (control.type === "checkbox") control.checked = Boolean(previous);
      else control.value = previous;
      const status = settingsRoot?.querySelector(".coi-visual-status");
      if (status) status.textContent = error.message || "Falha ao salvar.";
    }
  }

  function applySettings() {
    ensureCanvas();
    resizeCanvas();
    updateDayNight();
    if (!settings.particles_enabled) {
      particles = [];
      stopAnimation();
    }
    if (settingsRoot) {
      settingsRoot.querySelectorAll("[data-setting]").forEach(control => {
        const key = control.dataset.setting;
        if (key in settings) {
          if (control.type === "checkbox") control.checked = Boolean(settings[key]);
          else control.value = settings[key];
        }
      });
    }
  }

  async function loadSettings() {
    if (settingsLoaded || !tokenValue()) return;
    settingsLoaded = true;
    try {
      const response = await fetch("/api/game/meta/visual-settings", { headers: authorizedHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.settings) throw new Error(data.error || "Visual settings unavailable");
      settings = { ...DEFAULTS, ...data.settings };
    } catch (error) {
      console.debug("kingdom_visual_settings_unavailable", error?.message || error);
    }
    makeSettingsPanel();
    applySettings();
  }

  window.addEventListener("coi:game-ready", () => { void loadSettings(); });
  window.addEventListener("coi:game-battle", handleBattle);
  window.addEventListener("coi:visual-damage", event => {
    const value = Number(event.detail?.damage);
    if (!Number.isFinite(value) || value <= 0) return;
    floatingLabel((event.detail?.critical ? "CRIT! " : "") + "−" + value.toLocaleString("pt-BR"), "damage");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      particles = [];
      stopAnimation();
    } else {
      updateDayNight();
    }
  });
  window.addEventListener("pagehide", () => {
    particles = [];
    stopAnimation();
    if (dayNightTimer) window.clearInterval(dayNightTimer);
  }, { once: true });

  dayNightTimer = window.setInterval(updateDayNight, 60_000);
  if (document.readyState !== "loading" && tokenValue()) void loadSettings();
  window.CoiVisualEffects = Object.freeze({
    burst(x, y, count = 30, color = "#ffd36b") { spawnBurst(Number(x) || 0, Number(y) || 0, count, color); },
    damageNumber(value, critical = false) {
      const damage = Number(value);
      if (Number.isFinite(damage) && damage > 0) {
        floatingLabel((critical ? "CRIT! " : "") + "−" + damage.toLocaleString("pt-BR"), "damage");
      }
    },
  });
})();
