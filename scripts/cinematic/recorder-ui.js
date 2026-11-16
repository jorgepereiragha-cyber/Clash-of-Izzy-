import { CinematicCapture } from "./capture-system.js";
import { CINEMATIC_PRESETS, TRAILER_SCRIPT, buildTrailerTimeline } from "./trailer-script.js";

class TrailerRecorderUI {
  constructor(api) {
    this.api = api;
    this.capture = null;
    this.timer = 0;
    this.progressFrame = 0;
    this.progressStart = 0;
    this.progressDuration = 0;
    this.panel = null;
    this.init();
  }

  init() {
    if (!this.api || !document.body) return;
    this.createUI();
    this.bindEvents();
  }

  createUI() {
    this.panel = document.createElement("section");
    this.panel.id = "trailer-recorder-panel";
    this.panel.setAttribute("aria-label", "Gravador de trailer");
    this.panel.innerHTML = `
      <div class="coi-recorder-header">
        <h2>🎬 Gravador de Trailer</h2>
        <button id="coi-recorder-toggle" type="button" aria-expanded="true" aria-controls="coi-recorder-body">−</button>
      </div>
      <div class="coi-recorder-body" id="coi-recorder-body">
        <p class="coi-recorder-caption">Grave uma apresentação do seu reino em vídeo</p>
        <div class="coi-recorder-presets">
          <button class="coi-recorder-preset" type="button" data-preset="epic_intro">🌅 Abertura épica · 8s</button>
          <button class="coi-recorder-preset" type="button" data-preset="kingdom_tour">🏰 Tour do reino · 16s</button>
          <button class="coi-recorder-preset" type="button" data-preset="battle_zoom">⚔️ Preparação para guerra · 10s</button>
        </div>
        <details class="coi-recorder-custom">
          <summary>Trailer completo · 60 segundos</summary>
          <label for="coi-record-resolution">Resolução</label>
          <select id="coi-record-resolution">
            <option value="1280x720">HD · 1280 × 720</option>
            <option value="1920x1080">Full HD · 1920 × 1080</option>
          </select>
          <label for="coi-record-fps">Quadros por segundo</label>
          <select id="coi-record-fps">
            <option value="30" selected>30 FPS · recomendado</option>
            <option value="60">60 FPS · maior uso de recursos</option>
          </select>
          <label for="coi-record-duration">Duração do trailer</label>
          <input id="coi-record-duration" type="number" value="60" min="5" max="180" step="1" inputmode="numeric">
          <button id="coi-start-full-trailer" class="coi-recorder-primary" type="button">🎬 GRAVAR TRAILER</button>
        </details>
        <button id="coi-stop-recording" class="coi-recorder-stop" type="button" hidden>■ PARAR GRAVAÇÃO</button>
        <div class="coi-recorder-status" id="coi-recording-status" role="status" aria-live="polite">
          <span class="coi-recorder-indicator" aria-hidden="true"></span>
          <span class="coi-recorder-status-text">Pronto para gravar</span>
        </div>
        <div class="coi-recorder-progress" id="coi-record-progress" hidden>
          <div class="coi-recorder-progress-track"><span id="coi-progress-fill"></span></div>
          <div class="coi-recorder-progress-time"><span id="coi-current-time">0:00</span><span id="coi-total-time">1:00</span></div>
        </div>
        <p class="coi-recorder-footnote">A captura usa o mapa 3D do reino. Quando disponível, o navegador tenta manter a tela acesa durante a gravação; mantenha o PWA em primeiro plano, pois o sistema pode suspender a página ao sair do app ou bloquear a tela. A taxa de quadros depende do dispositivo. A gravação é mantida temporariamente na memória; durações longas podem ser bloqueadas em celulares para evitar falta de memória.</p>
      </div>
    `;
    const compactMobile = window.matchMedia?.("(max-width: 760px)")?.matches === true;
    if (compactMobile) {
      const body = this.panel.querySelector("#coi-recorder-body");
      const toggle = this.panel.querySelector("#coi-recorder-toggle");
      body.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "+";
    }
    document.body.append(this.panel);
  }

  bindEvents() {
    this.panel.querySelector("#coi-recorder-toggle").addEventListener("click", event => {
      const body = this.panel.querySelector("#coi-recorder-body");
      const collapsed = body.hidden;
      body.hidden = !collapsed;
      event.currentTarget.setAttribute("aria-expanded", String(collapsed));
      event.currentTarget.textContent = collapsed ? "−" : "+";
    });

    const trainingQuantity = document.getElementById("unitQuantity");
    if (trainingQuantity && window.matchMedia?.("(max-width: 760px)")?.matches) {
      trainingQuantity.addEventListener("focus", () => {
        this.panel.classList.add("is-keyboard-open");
      });
      trainingQuantity.addEventListener("blur", () => {
        this.panel.classList.remove("is-keyboard-open");
      });
    }

    this.panel.querySelectorAll("[data-preset]").forEach(button => {
      button.addEventListener("click", () => this.recordPreset(button.dataset.preset));
    });

    this.panel.querySelector("#coi-start-full-trailer").addEventListener("click", () => this.recordFullTrailer());
    this.panel.querySelector("#coi-stop-recording").addEventListener("click", () => this.stopRecording());

    window.addEventListener("cinematic-complete", event => this.onRecordingComplete(event.detail));
    window.addEventListener("cinematic-error", event => this.onRecordingError(event.detail));
  }

  async recordPreset(name) {
    const preset = CINEMATIC_PRESETS[name];
    if (!preset) {
      this.showStatus("Este preset não está disponível.", false);
      return;
    }
    await this.beginRecording({
      cameraPath: preset.camera,
      duration: preset.duration,
      textCues: [],
      width: 1280,
      height: 720,
      fps: 30
    }, "Gravando preset...");
  }

  async recordFullTrailer() {
    const resolution = this.panel.querySelector("#coi-record-resolution").value.split("x").map(Number);
    const fps = Number(this.panel.querySelector("#coi-record-fps").value);
    const duration = Number(this.panel.querySelector("#coi-record-duration").value);
    if (!Number.isInteger(duration) || duration < 5 || duration > 180) {
      this.showStatus("Escolha uma duração entre 5 e 180 segundos.", false);
      return;
    }
    const timeline = buildTrailerTimeline(TRAILER_SCRIPT, duration);
    await this.beginRecording({
      cameraPath: timeline.keyframes,
      textCues: timeline.textCues,
      duration: timeline.duration,
      width: resolution[0],
      height: resolution[1],
      fps
    }, "Gravando trailer completo...");
  }

  async beginRecording(config, message) {
    if (this.capture?.isRecording) return;
    this.capture = new CinematicCapture(this.api);
    try {
      this.capture.setCameraPath(config.cameraPath);
      this.capture.setTextCues(config.textCues);
      await this.capture.startRecording({
        width: config.width,
        height: config.height,
        fps: config.fps,
        bitrate: config.width >= 1920 ? 8000000 : 5000000,
        expectedDuration: config.duration
      });
      this.showStatus(message, true);
      this.setRecordingControls(true);
      this.startProgress(config.duration);
      this.timer = window.setTimeout(() => this.stopRecording(), config.duration * 1000);
    } catch (error) {
      this.capture = null;
      this.showStatus(error?.message || "Não foi possível iniciar a gravação.", false);
      this.setRecordingControls(false);
    }
  }

  stopRecording() {
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.stopProgress();
    if (this.capture?.stopRecording()) {
      this.showStatus("Finalizando e preparando o vídeo…", false);
      this.setRecordingControls(false);
      return;
    }
    this.setRecordingControls(false);
  }

  setRecordingControls(recording) {
    this.panel.querySelectorAll("[data-preset]").forEach(button => { button.disabled = recording; });
    this.panel.querySelector("#coi-start-full-trailer").disabled = recording;
    this.panel.querySelector("#coi-stop-recording").hidden = !recording;
  }

  showStatus(message, recording) {
    const status = this.panel.querySelector("#coi-recording-status");
    status.querySelector(".coi-recorder-status-text").textContent = message;
    status.querySelector(".coi-recorder-indicator").classList.toggle("is-recording", recording);
  }

  startProgress(duration) {
    this.stopProgress();
    this.progressDuration = duration;
    this.progressStart = performance.now();
    const container = this.panel.querySelector("#coi-record-progress");
    container.hidden = false;
    this.panel.querySelector("#coi-total-time").textContent = this.formatTime(duration);

    const update = now => {
      const elapsed = Math.min(duration, (now - this.progressStart) / 1000);
      const percent = Math.min(100, elapsed / duration * 100);
      this.panel.querySelector("#coi-progress-fill").style.width = percent + "%";
      this.panel.querySelector("#coi-current-time").textContent = this.formatTime(elapsed);
      if (elapsed < duration && this.capture?.isRecording) {
        this.progressFrame = requestAnimationFrame(update);
      }
    };
    this.progressFrame = requestAnimationFrame(update);
  }

  stopProgress() {
    if (this.progressFrame) cancelAnimationFrame(this.progressFrame);
    this.progressFrame = 0;
    const progress = this.panel?.querySelector("#coi-record-progress");
    if (progress) progress.hidden = true;
  }

  formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
  }

  onRecordingComplete(detail = {}) {
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.stopProgress();
    this.setRecordingControls(false);
    this.capture = null;
    this.showStatus("Trailer pronto para assistir e baixar.", false);
    if (detail.blob instanceof Blob && detail.blob.size > 0) this.showSuccessModal(detail.blob);
    else this.showStatus("A gravação terminou sem gerar um arquivo de vídeo.", false);
  }

  onRecordingError(detail = {}) {
    window.clearTimeout(this.timer);
    this.timer = 0;
    this.stopProgress();
    this.setRecordingControls(false);
    this.capture = null;
    this.showStatus(detail.message || "Não foi possível concluir a gravação.", false);
  }

  showSuccessModal(blob) {
    const extension = blob.type.includes("mp4") ? "mp4" : "webm";
    const filename = "clash-of-izzy-trailer-" + new Date().toISOString().replace(/[:.]/g, "-") + "." + extension;
    const url = URL.createObjectURL(blob);
    const modal = document.createElement("div");
    modal.className = "coi-cinematic-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "coi-cinematic-success-title");

    const card = document.createElement("div");
    card.className = "coi-cinematic-modal-card";
    const title = document.createElement("h2");
    title.id = "coi-cinematic-success-title";
    title.textContent = "🎬 Seu trailer está pronto";
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    const download = document.createElement("a");
    download.className = "coi-recorder-primary coi-recorder-download";
    download.href = url;
    download.download = filename;
    download.textContent = "⬇ BAIXAR VÍDEO";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "coi-recorder-close";
    close.textContent = "Fechar";
    const hint = document.createElement("p");
    hint.textContent = "O arquivo foi gerado no navegador. A conversão para MP4 pode ser feita depois, caso a plataforma de publicação exija esse formato.";

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      modal.remove();
    };
    close.addEventListener("click", cleanup);
    modal.addEventListener("click", event => { if (event.target === modal) cleanup(); });
    card.append(title, video, download, hint, close);
    modal.append(card);
    document.body.append(modal);
    close.focus();
  }
}

if (typeof window !== "undefined" && window.__coiKingdomCinematic) {
  window.trailerRecorder = new TrailerRecorderUI(window.__coiKingdomCinematic);
}
