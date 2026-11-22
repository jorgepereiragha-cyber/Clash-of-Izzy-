import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const official = readFileSync(new URL("../.github/workflows/publicar-apk-android.yml", import.meta.url), "utf8");
const candidate = readFileSync(new URL("../.github/workflows/android-candidate-apk.yml", import.meta.url), "utf8");

test("first public release upgrades the existing signed internal candidate", () => {
  assert.ok(candidate.includes('ANDROID_VERSION_CODE: "2"'));
  assert.ok(official.includes("ANDROID_VERSION_CODE > 2"));
  assert.ok(official.includes("VersionCode deve ser >= 3"));
});

test("public release still requires manual confirmation, signed certificate, server and payment gates", () => {
  for (const gate of ["PUBLICAR_APK_OFICIAL", "check-android-release-server.mjs",
    "check-commercial-store.mjs", "apksigner", "sha256sum -c", "gh release create"]) {
    assert.ok(official.includes(gate), "Gate ausente: "+gate);
  }
});
