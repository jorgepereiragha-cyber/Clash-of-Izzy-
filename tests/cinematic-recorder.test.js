import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TRAILER_SCRIPT, CINEMATIC_PRESETS, buildTrailerTimeline } from "../scripts/cinematic/trailer-script.js";
import { MEDIA_RECORDER_MIME_TYPES, selectMediaRecorderMimeType, estimateRecordingBytes, getRecordingMemoryBudget } from "../scripts/cinematic/media-recorder-support.js";

const capture = await readFile(new URL("../scripts/cinematic/capture-system.js", import.meta.url), "utf8");
const mediaSupport = await readFile(new URL("../scripts/cinematic/media-recorder-support.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../scripts/cinematic/recorder-ui.js", import.meta.url), "utf8");
const renderer = await readFile(new URL("../scripts/kingdom-3d.js", import.meta.url), "utf8");
const kingdom = await readFile(new URL("../kingdom.html", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const premiumCss = await readFile(new URL("../styles/premium-ui.css", import.meta.url), "utf8");

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
  assert.match(capture, /video\/webm;codecs=vp9/);
  assert.match(capture, /video\/webm;codecs=vp8/);
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
  assert.match(kingdom, /type="module" src="\/scripts\/cinematic\/recorder-ui\.js"/);
});

test("PWA and shared styles include the recorder resources", () => {
  assert.match(serviceWorker, /clash-of-izzy-shell-v22/);
  for (const path of [
    "/scripts/cinematic/capture-system.js",
    "/scripts/cinematic/media-recorder-support.js",
    "/scripts/cinematic/trailer-script.js",
    "/scripts/cinematic/recorder-ui.js"
  ]) assert.ok(serviceWorker.includes(path), "Recurso cinematográfico ausente do cache: " + path);
  assert.match(premiumCss, /CINEMATIC TRAILER RECORDER/);
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
