export const MEDIA_RECORDER_MIME_TYPES = Object.freeze([
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm"
]);

export function selectMediaRecorderMimeType(MediaRecorderConstructor) {
  const supports = MediaRecorderConstructor?.isTypeSupported;
  if (typeof supports !== "function") return "";

  for (const mimeType of MEDIA_RECORDER_MIME_TYPES) {
    try {
      if (supports.call(MediaRecorderConstructor, mimeType)) return mimeType;
    } catch {
      // A browser implementation may throw for codecs it does not recognize.
    }
  }
  return "";
}

export function estimateRecordingBytes(videoBitsPerSecond, durationSeconds) {
  const bitrate = Number(videoBitsPerSecond);
  const duration = Number(durationSeconds);
  if (!Number.isFinite(bitrate) || bitrate <= 0 ||
      !Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("Bitrate e duração precisam ser valores positivos.");
  }
  // Allow a 15% container/metadata margin over the nominal video bitrate.
  return Math.ceil((bitrate * duration / 8) * 1.15);
}

export function getRecordingMemoryBudget(deviceMemoryGiB) {
  const memory = Number(deviceMemoryGiB);
  if (Number.isFinite(memory) && memory > 0 && memory <= 4) return 48 * 1024 * 1024;
  if (Number.isFinite(memory) && memory >= 8) return 128 * 1024 * 1024;
  return 64 * 1024 * 1024;
}
