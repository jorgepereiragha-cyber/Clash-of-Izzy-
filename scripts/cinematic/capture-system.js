import { estimateRecordingBytes, getRecordingMemoryBudget, selectMediaRecorderMimeType } from "./media-recorder-support.js";

export class CinematicTextRenderer {
  render(context, width, height, cue, elapsed) {
    if (!cue || elapsed < cue.startTime || elapsed > cue.endTime) return;

    const duration = Math.max(0.001, cue.endTime - cue.startTime);
    const progress = (elapsed - cue.startTime) / duration;
    const fade = Math.min(1, progress / 0.12, (1 - progress) / 0.12);
    const alpha = Math.max(0, Math.min(1, fade));
    const scale = Math.min(width / 1920, height / 1080);
    const styles = {
      epic: { size: 76, color: "#f5d995", stroke: "#463019", shadow: "rgba(231,189,104,.65)" },
      legendary: { size: 88, color: "#fff0a8", stroke: "#765019", shadow: "rgba(255,215,100,.82)" },
      action: { size: 72, color: "#ffd1bd", stroke: "#641d18", shadow: "rgba(169,67,59,.75)" },
      cta: { size: 54, color: "#f5d995", stroke: "#463019", shadow: "rgba(231,189,104,.7)" }
    };
    const style = styles[cue.style] || styles.epic;
    const lines = String(cue.content || "").split("\n");
    const fontSize = Math.max(22, style.size * scale);
    const lineHeight = fontSize * 1.24;
    const x = width / 2;
    const blockHeight = lineHeight * lines.length;
    let y = (height - blockHeight) / 2 + lineHeight / 2;
    if (cue.position === "bottom") y = height * 0.78 - blockHeight / 2 + lineHeight / 2;
    if (cue.position === "top") y = height * 0.2 - blockHeight / 2 + lineHeight / 2;

    context.save();
    context.globalAlpha = alpha;
    context.font = "700 " + fontSize + 'px "Cinzel", Georgia, serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.shadowColor = style.shadow;
    context.shadowBlur = 18 * scale;
    context.lineWidth = Math.max(2, 4 * scale);
    context.strokeStyle = style.stroke;
    context.fillStyle = style.color;
    for (const line of lines) {
      const safeLine = line.slice(0, 90);
      context.strokeText(safeLine, x, y, width * 0.88);
      context.fillText(safeLine, x, y, width * 0.88);
      y += lineHeight;
    }
    context.restore();
  }
}

export class CinematicCapture {
  constructor(cinematicApi) {
    if (!cinematicApi || typeof cinematicApi.getContext !== "function") {
      throw new Error("O renderizador 3D do reino não está disponível.");
    }
    this.api = cinematicApi;
    this.view = null;
    this.recorder = null;
    this.selectedMimeType = "";
    this.stream = null;
    this.captureCanvas = null;
    this.captureContext = null;
    this.chunks = [];
    this.cameraPath = [];
    this.textCues = [];
    this.isRecording = false;
    this.frameRequest = 0;
    this.startTime = 0;
    this.lastFrameTime = 0;
    this.recordingError = null;
    this.originalRendererSize = null;
    this.originalPixelRatio = 1;
    this.originalCamera = null;
    this.originalValhallaMode = false;
    this.restored = true;
    this.textRenderer = new CinematicTextRenderer();
  }

  setCameraPath(keyframes) {
    if (!Array.isArray(keyframes) || keyframes.length < 2) {
      throw new TypeError("O trajeto da câmera precisa de pelo menos dois keyframes.");
    }
    const normalized = keyframes.map(frame => {
      if (!Number.isFinite(Number(frame.time)) ||
          !Array.isArray(frame.position) || frame.position.length !== 3 ||
          !Array.isArray(frame.lookAt) || frame.lookAt.length !== 3 ||
          ![...frame.position, ...frame.lookAt].every(value => Number.isFinite(Number(value)))) {
        throw new TypeError("Keyframe cinematográfico inválido.");
      }
      return { ...frame, time: Number(frame.time) };
    }).sort((a, b) => a.time - b.time);
    if (normalized[0].time < 0 || normalized.some((frame, index) => index > 0 && frame.time <= normalized[index - 1].time)) {
      throw new TypeError("Os tempos dos keyframes precisam ser crescentes e únicos.");
    }
    this.cameraPath = normalized;
  }

  setTextCues(cues) {
    this.textCues = Array.isArray(cues) ? cues.filter(cue =>
      cue && Number.isFinite(cue.startTime) && Number.isFinite(cue.endTime) &&
      cue.endTime > cue.startTime && typeof cue.content === "string"
    ) : [];
  }

  _supportedMimeType() {
    return selectMediaRecorderMimeType(MediaRecorder);
  }

  async startRecording(options = {}) {
    if (this.isRecording) throw new Error("Já existe uma gravação em andamento.");
    if (typeof MediaRecorder === "undefined") throw new Error("Este navegador não oferece suporte a MediaRecorder.");
    if (typeof HTMLCanvasElement === "undefined" ||
        typeof HTMLCanvasElement.prototype.captureStream !== "function") {
      throw new Error("Este navegador não oferece captura de vídeo pelo canvas.");
    }

    const width = Math.round(Number(options.width) || 1280);
    const height = Math.round(Number(options.height) || 720);
    const fps = Math.round(Number(options.fps) || 30);
    const bitrate = Math.max(2500000, Math.min(12000000, Number(options.bitrate) || 5000000));
    const expectedDuration = Math.max(1, Math.min(180, Number(options.expectedDuration) || 60));
    if (width < 640 || width > 1920 || height < 360 || height > 1080 || fps < 24 || fps > 60) {
      throw new RangeError("Use resolução entre 640×360 e 1920×1080 e frequência entre 24 e 60 FPS.");
    }
    const estimatedBytes = estimateRecordingBytes(bitrate, expectedDuration);
    const memoryBudget = getRecordingMemoryBudget(
      typeof navigator !== "undefined" ? navigator.deviceMemory : undefined
    );
    if (estimatedBytes > memoryBudget) {
      const estimatedMiB = Math.ceil(estimatedBytes / (1024 * 1024));
      const budgetMiB = Math.floor(memoryBudget / (1024 * 1024));
      throw new Error(
        "Esta gravação pode usar cerca de " + estimatedMiB +
        " MB, acima do limite seguro de " + budgetMiB +
        " MB deste dispositivo. Reduza a duração, a resolução ou o FPS."
      );
    }

    const view = this.api.getContext();
    if (!view?.renderer || !view?.scene || !view?.camera) {
      throw new Error("A cena 3D ainda não está pronta para gravação.");
    }
    if (Math.max(width, height) > (view.renderer.capabilities?.maxTextureSize || 4096)) {
      throw new Error("A resolução escolhida excede o limite gráfico deste dispositivo.");
    }

    this.view = view;
    const sizeTarget = { x: 0, y: 0, set(widthValue, heightValue) { this.x = widthValue; this.y = heightValue; return this; } };
    this.originalRendererSize = view.renderer.getSize(sizeTarget);
    this.originalPixelRatio = view.renderer.getPixelRatio();
    this.originalCamera = {
      position: view.camera.position.clone(),
      quaternion: view.camera.quaternion.clone(),
      zoom: view.camera.zoom,
      left: view.camera.left,
      right: view.camera.right,
      top: view.camera.top,
      bottom: view.camera.bottom,
      aspect: view.camera.aspect,
      fov: view.camera.fov
    };
    this.originalValhallaMode = this.api.getValhallaMode?.() === true;
    this.restored = false;
    this.recordingError = null;
    this.chunks = [];

    try {
      if (this.api.setCaptureActive?.(true) === false) {
        throw new Error("O renderizador não conseguiu entrar no modo de captura.");
      }

      this.captureCanvas = document.createElement("canvas");
      this.captureCanvas.width = width;
      this.captureCanvas.height = height;
      this.captureContext = this.captureCanvas.getContext("2d", { alpha: false });
      if (!this.captureContext) throw new Error("Não foi possível preparar o canvas de gravação.");

      view.renderer.setPixelRatio(1);
      view.renderer.setSize(width, height, false);
      this.api.setCaptureViewport?.(width / height);

      this.stream = this.captureCanvas.captureStream(fps);
      const mimeType = this._supportedMimeType();
      this.selectedMimeType = mimeType;
      const recorderOptions = { videoBitsPerSecond: bitrate };
      if (mimeType) recorderOptions.mimeType = mimeType;
      try {
        this.recorder = new MediaRecorder(this.stream, recorderOptions);
      } catch (codecError) {
        if (!mimeType) throw codecError;
        // Some mobile browsers report a codec as supported but reject the
        // options when the recorder is instantiated. Retry browser selection.
        this.selectedMimeType = "";
        try {
          this.recorder = new MediaRecorder(this.stream, { videoBitsPerSecond: bitrate });
        } catch {
          throw new Error("O navegador recusou os codecs de vídeo disponíveis para esta gravação.", { cause: codecError });
        }
      }
      this.recorder.ondataavailable = event => {
        if (event.data?.size > 0) this.chunks.push(event.data);
      };
      this.recorder.onerror = event => {
        this.recordingError = event.error || new Error("O navegador encontrou um erro durante a gravação.");
        if (this.isRecording) this.stopRecording();
      };
      this.recorder.onstop = () => this._onRecordingStopped();
      this.recorder.start(1000);

      this.isRecording = true;
      this.startTime = performance.now();
      this.lastFrameTime = this.startTime;
      this._animateCamera(0);
      this._captureLoop();
      return true;
    } catch (error) {
      this.isRecording = false;
      this._restoreEnvironment();
      throw error;
    }
  }

  _captureLoop() {
    if (!this.isRecording) return;
    try {
      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000;
      const delta = Math.min(0.05, Math.max(0, (now - this.lastFrameTime) / 1000));
      this.lastFrameTime = now;

      this._animateCamera(elapsed);
      this.api.renderFrame?.(delta);
      this.captureContext.drawImage(
        this.view.renderer.domElement,
        0, 0,
        this.captureCanvas.width,
        this.captureCanvas.height
      );
      for (const cue of this.textCues) {
        this.textRenderer.render(this.captureContext, this.captureCanvas.width, this.captureCanvas.height, cue, elapsed);
      }
      this.frameRequest = requestAnimationFrame(() => this._captureLoop());
    } catch (error) {
      this.recordingError = error;
      this.stopRecording();
    }
  }

  _animateCamera(elapsed) {
    if (!this.cameraPath.length) return;
    const camera = this.view.camera;
    let current = this.cameraPath[0];
    let next = current;
    let progress = 0;

    if (elapsed >= this.cameraPath[this.cameraPath.length - 1].time) {
      current = this.cameraPath[this.cameraPath.length - 1];
      next = current;
    } else {
      for (let index = 0; index < this.cameraPath.length - 1; index++) {
        const from = this.cameraPath[index];
        const to = this.cameraPath[index + 1];
        if (elapsed >= from.time && elapsed < to.time) {
          current = from;
          next = to;
          progress = (elapsed - from.time) / (to.time - from.time);
          break;
        }
      }
    }

    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const mix = (a, b) => a + (b - a) * eased;
    const position = current.position.map((value, index) => mix(Number(value), Number(next.position[index])));
    const target = current.lookAt.map((value, index) => mix(Number(value), Number(next.lookAt[index])));

    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);

    if (camera.isOrthographicCamera && current.zoom !== undefined && next.zoom !== undefined) {
      camera.zoom = mix(Number(current.zoom), Number(next.zoom));
      camera.updateProjectionMatrix();
    } else if (camera.isPerspectiveCamera && current.fov !== undefined && next.fov !== undefined) {
      camera.fov = mix(Number(current.fov), Number(next.fov));
      camera.updateProjectionMatrix();
    }

    const desiredValhalla = current.valhalla === true;
    if (this.api.getValhallaMode?.() !== desiredValhalla) {
      this.api.setValhallaMode?.(desiredValhalla);
    }
  }

  stopRecording() {
    if (!this.isRecording) return false;
    this.isRecording = false;
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    } else {
      this._onRecordingStopped();
    }
    return true;
  }

  _onRecordingStopped() {
    const type = this.recorder?.mimeType || this.selectedMimeType || "video/webm";
    const blob = new Blob(this.chunks, { type });
    const elapsed = this.startTime ? Math.max(0, (performance.now() - this.startTime) / 1000) : 0;
    this._restoreEnvironment();

    if (this.recordingError || blob.size === 0) {
      window.dispatchEvent(new CustomEvent("cinematic-error", {
        detail: { message: this.recordingError?.message || "O navegador não gerou dados de vídeo." }
      }));
      return;
    }
    window.dispatchEvent(new CustomEvent("cinematic-complete", {
      detail: { blob, duration: elapsed, mimeType: type }
    }));
  }

  _restoreEnvironment() {
    if (this.restored) return;
    this.restored = true;
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;

    for (const track of this.stream?.getTracks?.() || []) track.stop();

    const renderer = this.view?.renderer;
    const camera = this.view?.camera;
    try {
      if (renderer && this.originalRendererSize) {
        renderer.setPixelRatio(this.originalPixelRatio);
        renderer.setSize(this.originalRendererSize.x, this.originalRendererSize.y, false);
      }
      if (camera && this.originalCamera) {
        camera.position.copy(this.originalCamera.position);
        camera.quaternion.copy(this.originalCamera.quaternion);
        if (camera.isOrthographicCamera) {
          camera.left = this.originalCamera.left;
          camera.right = this.originalCamera.right;
          camera.top = this.originalCamera.top;
          camera.bottom = this.originalCamera.bottom;
        }
        if (camera.isPerspectiveCamera) {
          camera.aspect = this.originalCamera.aspect;
          camera.fov = this.originalCamera.fov;
        }
        if (this.originalCamera.zoom !== undefined) camera.zoom = this.originalCamera.zoom;
        camera.updateProjectionMatrix();
      }
      this.api.setValhallaMode?.(this.originalValhallaMode);
      this.api.setCaptureActive?.(false);
    } catch (error) {
      console.warn("Clash of Izzy: não foi possível restaurar completamente a visualização após a gravação.", error);
    }

    this.captureCanvas = null;
    this.captureContext = null;
    this.stream = null;
    this.recorder = null;
    this.selectedMimeType = "";
    this.view = null;
    this.originalRendererSize = null;
    this.originalCamera = null;
  }
}
