import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TRAILER_SCRIPT, CINEMATIC_PRESETS, buildTrailerTimeline } from "../scripts/cinematic/trailer-script.js";
import { MEDIA_RECORDER_MIME_TYPES, selectMediaRecorderMimeType, estimateRecordingBytes, getRecordingMemoryBudget } from "../scripts/cinematic/media-recorder-support.js";
import { CinematicCapture } from "../scripts/cinematic/capture-system.js";

const capture = await readFile(new URL("../scripts/cinematic/capture-system.js", import.meta.url), "utf8");
const mediaSupport = await readFile(new URL("../scripts/cinematic/media-recorder-support.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../scripts/cinematic/recorder-ui.js", import.meta.url), "utf8");
const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const premiumCss = await readFile(new URL("../styles/premium-ui.css", import.meta.url), "utf8");

function setTestGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: previous?.enumerable ?? true,
    writable: true,
    value
  });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  };
}

function makeVector3(x, y, z) {
  return {
    x, y, z,
    set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; return this; },
    copy(other) { this.x = other.x; this.y = other.y; this.z = other.z; return this; },
    clone() { return makeVector3(this.x, this.y, this.z); }
  };
}

function createCaptureHarness({
  rejectExplicitMime = false,
  deviceMemory = 4,
  wakeLockSupported = false,
  rejectWakeLock = false
} = {}) {
  const restores = [];
  const events = [];
  const constructorOptions = [];
  const sentinels = [];
  const documentListeners = new Map();
  let trackStopped = false;
  let active = false;
  let renderedFrames = 0;
  let frameId = 0;
  let wakeLockRequests = 0;
  let wakeLockReleases = 0;

  class FakeMediaRecorder {
    static isTypeSupported(type) {
      return type === "video/webm;codecs=vp8";
    }
    constructor(stream, options = {}) {
      constructorOptions.push({ ...options });
      if (rejectExplicitMime && options.mimeType) {
        throw new Error("The mobile encoder rejected the requested codec.");
      }
      this.stream = stream;
      this.mimeType = options.mimeType || "video/webm";
      this.state = "inactive";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["mock-video-frame"], { type: this.mimeType }) });
      this.onstop?.();
    }
  }

  class FakeCanvas {
    constructor() {
      this.width = 0;
      this.height = 0;
    }
    getContext() {
      return { drawImage() {}, save() {}, restore() {} };
    }
    captureStream(fps) {
      this.fps = fps;
      return { getTracks: () => [{ stop() { trackStopped = true; } }] };
    }
  }

  const fakeDocument = {
    visibilityState: "visible",
    createElement: () => new FakeCanvas(),
    addEventListener(type, handler) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      documentListeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      for (const handler of documentListeners.get(event.type) || []) handler(event);
    }
  };
  const fakeNavigator = { deviceMemory };
  if (wakeLockSupported) {
    fakeNavigator.wakeLock = {
      async request(type) {
        wakeLockRequests++;
        if (type !== "screen") throw new Error("Unsupported wake lock type");
        if (rejectWakeLock) throw new Error("Wake lock denied by platform");
        const listeners = new Map();
        const sentinel = {
          released: false,
          addEventListener(eventType, handler) {
            if (!listeners.has(eventType)) listeners.set(eventType, new Set());
            listeners.get(eventType).add(handler);
          },
          async release() {
            if (this.released) return;
            this.released = true;
            wakeLockReleases++;
            for (const handler of listeners.get("release") || []) handler({ type: "release" });
          }
        };
        sentinels.push(sentinel);
        return sentinel;
      }
    };
  }

  const renderer = {
    width: 800,
    height: 600,
    pixelRatio: 1.5,
    capabilities: { maxTextureSize: 4096 },
    domElement: {},
    getSize(target) { return target.set(this.width, this.height); },
    getPixelRatio() { return this.pixelRatio; },
    setPixelRatio(value) { this.pixelRatio = value; },
    setSize(width, height) { this.width = width; this.height = height; }
  };
  const originalPosition = makeVector3(1, 2, 3);
  const camera = {
    isOrthographicCamera: true,
    isPerspectiveCamera: false,
    position: originalPosition,
    quaternion: {
      x: 0, y: 0, z: 0, w: 1,
      clone() { return { ...this }; },
      copy(other) { Object.assign(this, other); }
    },
    zoom: 1,
    left: -8, right: 8, top: 6, bottom: -6,
    updateProjectionMatrix() {},
    lookAt() {}
  };
  const api = {
    getContext() { return { renderer, scene: {}, camera }; },
    setCaptureActive(value) { active = value; return true; },
    setCaptureViewport() { return true; },
    renderFrame() { renderedFrames++; },
    getValhallaMode() { return false; },
    setValhallaMode() {}
  };

  restores.push(setTestGlobal("MediaRecorder", FakeMediaRecorder));
  restores.push(setTestGlobal("HTMLCanvasElement", FakeCanvas));
  restores.push(setTestGlobal("document", fakeDocument));
  restores.push(setTestGlobal("window", { dispatchEvent(event) { events.push(event); } }));
  restores.push(setTestGlobal("CustomEvent", class {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }));
  restores.push(setTestGlobal("requestAnimationFrame", () => ++frameId));
  restores.push(setTestGlobal("cancelAnimationFrame", () => {}));
  restores.push(setTestGlobal("navigator", fakeNavigator));

  return {
    api, renderer, camera, events, constructorOptions,
    get trackStopped() { return trackStopped; },
    get active() { return active; },
    get renderedFrames() { return renderedFrames; },
    get wakeLockRequests() { return wakeLockRequests; },
    get wakeLockReleases() { return wakeLockReleases; },
    get sentinels() { return sentinels; },
    setVisibility(state) {
      fakeDocument.visibilityState = state;
      fakeDocument.dispatchEvent({ type: "visibilitychange" });
    },
    restore() { for (const restore of restores.reverse()) restore(); }
  };
}

test("trailer timeline uses the duration selected in the recorder and continuous keyframes", () => {
  const timeline = buildTrailerTimeline(TRAILER_SCRIPT, 90);
  assert.equal(timeline.duration, 90);
  assert.equal(timeline.keyframes[0].time, 0);
  assert.equal(timeline.keyframes.at(-1).time, 90);
  assert.ok(timeline.keyframes.every((frame, index, frames) =>
    index === 0 || frame.time > frames[index - 1].time
  ));
  assert.ok(timeline.textCues.every(cue => cue.startTime >= 0 && cue.endTime <= 90));
});

test("camera presets match their displayed durations and the actual kingdom world scale", () => {
  assert.equal(CINEMATIC_PRESETS.epic_intro.duration, 8);
  assert.equal(CINEMATIC_PRESETS.kingdom_tour.duration, 16);
  assert.equal(CINEMATIC_PRESETS.battle_zoom.duration, 10);
  for (const scene of TRAILER_SCRIPT.scenes) {
    for (const frame of scene.camera) {
      assert.ok([...frame.position, ...frame.lookAt].every(value => Math.abs(value) <= 20),
        "A câmera do trailer saiu da escala do mapa 3D: " + scene.id);
    }
  }
  assert.ok(TRAILER_SCRIPT.scenes.some(scene => scene.text?.content === "ASCENDA A VALHALLA"));
});

test("capture negotiates browser codecs and restores the original renderer and camera", () => {
  assert.match(mediaSupport, /isTypeSupported/);
  assert.match(mediaSupport, /video\/webm;codecs=vp9/);
  assert.match(mediaSupport, /video\/webm;codecs=vp8/);
  assert.match(capture, /setCaptureActive\?\.\(true\)/);
  assert.match(capture, /setCaptureActive\?\.\(false\)/);
  assert.match(capture, /originalRendererSize/);
  assert.match(capture, /originalCamera\.quaternion/);
  assert.match(capture, /camera\.isOrthographicCamera/);
  assert.match(capture, /new CustomEvent\("cinematic-complete"/);
  assert.match(capture, /new CustomEvent\("cinematic-error"/);
});

test("recorder uses the renderer API instead of an assumed window.map3d global", () => {
  assert.match(renderer, /window\.__coiKingdomCinematic = cinematicApi/);
  assert.match(renderer, /cinematicCaptureActive \|\| !renderer/);
  assert.match(renderer, /setCaptureViewport\(aspect\)/);
  assert.match(renderer, /renderFrame\(delta = 0\)/);
  assert.match(ui, /new CinematicCapture\(this\.api\)/);
  assert.doesNotMatch(ui, /window\.map3d/);
  assert.doesNotMatch(kingdom, /type="module" src="\/scripts\/cinematic\/recorder-ui\.js"/);
});

test("PWA does not preload the trailer recorder; cached overlays are hidden", () => {
  const cacheVersion = Number(serviceWorker.match(/const CACHE_NAME="clash-of-izzy-shell-v(\d+)"/)?.[1] || 0);
  assert.ok(cacheVersion >= 50, "expected new service worker cache version");
  for (const path of [
    "/scripts/cinematic/capture-system.js",
    "/scripts/cinematic/media-recorder-support.js",
    "/scripts/cinematic/trailer-script.js",
    "/scripts/cinematic/recorder-ui.js"
  ]) assert.ok(!serviceWorker.includes(path), "Nenhum módulo de gravação deve ser pré-carregado: " + path);
  assert.match(premiumCss, /#trailer-recorder-panel\{display:none!important\}/);
  assert.match(ui, /URL\.revokeObjectURL\(url\)/);
});

test("mobile codec negotiation prefers supported VP9/VP8 and falls back to H.264 MP4", () => {
  const supported = type => type === "video/webm;codecs=vp8";
  assert.equal(selectMediaRecorderMimeType({ isTypeSupported: supported }), "video/webm;codecs=vp8");
  assert.equal(selectMediaRecorderMimeType({ isTypeSupported: type => type === "video/mp4;codecs=avc1" }), "video/mp4;codecs=avc1");
  assert.equal(selectMediaRecorderMimeType({ isTypeSupported: () => false }), "");
  assert.equal(selectMediaRecorderMimeType({}), "");
  assert.ok(MEDIA_RECORDER_MIME_TYPES.includes("video/mp4;codecs=avc1.42E01E"));
});

test("codec probing tolerates browser exceptions and uses native MIME selection as a fallback", () => {
  const mime = selectMediaRecorderMimeType({
    isTypeSupported(type) {
      if (type.includes("vp9")) throw new Error("codec probe failed");
      return type === "video/mp4";
    }
  });
  assert.equal(mime, "video/mp4");
});

test("recording preflight estimates memory and applies a conservative mobile budget", () => {
  assert.equal(estimateRecordingBytes(5000000, 60), Math.ceil((5000000 * 60 / 8) * 1.15));
  assert.equal(getRecordingMemoryBudget(4), 48 * 1024 * 1024);
  assert.equal(getRecordingMemoryBudget(6), 64 * 1024 * 1024);
  assert.equal(getRecordingMemoryBudget(8), 128 * 1024 * 1024);
  assert.throws(() => estimateRecordingBytes(0, 60), /positivos/);
  assert.throws(() => estimateRecordingBytes(5000000, -1), /positivos/);
  assert.match(mediaSupport, /15% container/);
});

test("real capture flow uses the mobile codec and restores renderer, camera and stream", async () => {
  const harness = createCaptureHarness();
  try {
    const capture = new CinematicCapture(harness.api);
    capture.setCameraPath([
      { time: 0, position: [4, 6, 8], lookAt: [0, 0, 0], zoom: 1 },
      { time: 8, position: [5, 7, 9], lookAt: [0, 0, 0], zoom: 1.1 }
    ]);
    await capture.startRecording({ width: 1280, height: 720, fps: 30, bitrate: 2500000, expectedDuration: 8 });
    assert.equal(capture.isRecording, true);
    assert.equal(harness.active, true);
    assert.equal(harness.renderer.width, 1280);
    assert.equal(harness.renderer.height, 720);
    assert.equal(harness.renderer.pixelRatio, 1);
    assert.equal(harness.constructorOptions[0].mimeType, "video/webm;codecs=vp8");
    assert.ok(harness.renderedFrames > 0);

    assert.equal(capture.stopRecording(), true);
    const completed = harness.events.find(event => event.type === "cinematic-complete");
    assert.ok(completed?.detail.blob.size > 0);
    assert.equal(completed.detail.mimeType, "video/webm;codecs=vp8");
    assert.equal(harness.renderer.width, 800);
    assert.equal(harness.renderer.height, 600);
    assert.equal(harness.renderer.pixelRatio, 1.5);
    assert.deepEqual(
      [harness.camera.position.x, harness.camera.position.y, harness.camera.position.z],
      [1, 2, 3]
    );
    assert.equal(harness.active, false);
    assert.equal(harness.trackStopped, true);
  } finally {
    harness.restore();
  }
});

test("capture retries native codec selection when the mobile encoder rejects an explicit MIME", async () => {
  const harness = createCaptureHarness({ rejectExplicitMime: true });
  try {
    const capture = new CinematicCapture(harness.api);
    capture.setCameraPath([
      { time: 0, position: [4, 6, 8], lookAt: [0, 0, 0], zoom: 1 },
      { time: 5, position: [5, 7, 9], lookAt: [0, 0, 0], zoom: 1.1 }
    ]);
    await capture.startRecording({ width: 1280, height: 720, fps: 30, bitrate: 2500000, expectedDuration: 5 });
    assert.equal(harness.constructorOptions.length, 2);
    assert.equal(harness.constructorOptions[0].mimeType, "video/webm;codecs=vp8");
    assert.equal("mimeType" in harness.constructorOptions[1], false);
    capture.stopRecording();
    const completed = harness.events.find(event => event.type === "cinematic-complete");
    assert.equal(completed.detail.mimeType, "video/webm");
    assert.ok(completed.detail.blob.size > 0);
  } finally {
    harness.restore();
  }
});

test("screen wake lock is reacquired after the page becomes visible and released after recording", async () => {
  const harness = createCaptureHarness({ wakeLockSupported: true });
  try {
    const capture = new CinematicCapture(harness.api);
    capture.setCameraPath([
      { time: 0, position: [4, 6, 8], lookAt: [0, 0, 0], zoom: 1 },
      { time: 8, position: [5, 7, 9], lookAt: [0, 0, 0], zoom: 1.1 }
    ]);
    await capture.startRecording({ width: 1280, height: 720, fps: 30, bitrate: 2500000, expectedDuration: 8 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.wakeLockRequests, 1);
    assert.equal(capture.wakeLock?.released, false);

    harness.setVisibility("hidden");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.wakeLockReleases, 1);
    assert.equal(capture.wakeLock, null);

    harness.setVisibility("visible");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.wakeLockRequests, 2);
    assert.equal(capture.wakeLock?.released, false);

    capture.stopRecording();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.wakeLockReleases, 2);
    assert.equal(capture.wakeLock, null);
    assert.equal(harness.active, false);
  } finally {
    harness.restore();
  }
});

test("recording continues when the browser does not support or grant screen wake lock", async () => {
  for (const options of [{}, { wakeLockSupported: true, rejectWakeLock: true }]) {
    const harness = createCaptureHarness(options);
    try {
      const capture = new CinematicCapture(harness.api);
      capture.setCameraPath([
        { time: 0, position: [4, 6, 8], lookAt: [0, 0, 0], zoom: 1 },
        { time: 5, position: [5, 7, 9], lookAt: [0, 0, 0], zoom: 1.1 }
      ]);
      await capture.startRecording({ width: 1280, height: 720, fps: 30, bitrate: 2500000, expectedDuration: 5 });
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(capture.isRecording, true);
      assert.equal(harness.wakeLockRequests, options.wakeLockSupported ? 1 : 0);
      capture.stopRecording();
    } finally {
      harness.restore();
    }
  }
});

test("low-memory devices reject unsafe recording duration before resizing the kingdom renderer", async () => {
  const harness = createCaptureHarness({ deviceMemory: 4 });
  try {
    const capture = new CinematicCapture(harness.api);
    capture.setCameraPath([
      { time: 0, position: [4, 6, 8], lookAt: [0, 0, 0], zoom: 1 },
      { time: 180, position: [5, 7, 9], lookAt: [0, 0, 0], zoom: 1.1 }
    ]);
    await assert.rejects(
      capture.startRecording({ width: 1280, height: 720, fps: 30, bitrate: 5000000, expectedDuration: 180 }),
      /acima do limite seguro/
    );
    assert.equal(harness.active, false);
    assert.equal(harness.renderer.width, 800);
    assert.equal(harness.renderer.height, 600);
    assert.equal(harness.constructorOptions.length, 0);
  } finally {
    harness.restore();
  }
});

test("lazy kingdom GPU initialization publishes recorder availability without duplicate panels", async () => {
  const rendererSource = await import("node:fs/promises").then(fs =>
    fs.readFile(new URL("../scripts/kingdom-3d.js",import.meta.url),"utf8"));
  const uiSource = await import("node:fs/promises").then(fs =>
    fs.readFile(new URL("../scripts/cinematic/recorder-ui.js",import.meta.url),"utf8"));
  assert.match(rendererSource, /new CustomEvent\("coi:kingdom-cinematic-ready"\)/);
  assert.match(uiSource, /window\.addEventListener\("coi:kingdom-cinematic-ready", ensureTrailerRecorder\)/);
  assert.match(uiSource, /window\.trailerRecorder/);
  assert.match(uiSource, /if \(typeof window === "undefined" \|\| !window\.__coiKingdomCinematic \|\| window\.trailerRecorder\) return/);
});
