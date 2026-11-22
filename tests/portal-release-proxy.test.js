import test from "node:test";
import assert from "node:assert/strict";
import { validateOfficialRelease, readOfficialRelease } from "../portal-worker.js";

const base = "https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/releases/download/v1.2.3/";
const apk = "clash-of-izzy-android.apk";
function fixture() {
  return {
    draft: false, prerelease: false, tag_name: "v1.2.3",
    assets: [
      {name: apk, state: "uploaded", size: 4222222, browser_download_url: base + apk},
      {name: apk + ".sha256", state: "uploaded", size: 98, browser_download_url: base + apk + ".sha256"}
    ],
    sensitive_field_not_returned: "discard"
  };
}

test("release proxy accepts only uploaded APK and matching checksum from exact official GitHub URLs", () => {
  const release = validateOfficialRelease(fixture());
  assert.equal(release.tag_name, "v1.2.3");
  assert.equal(release.assets.length, 2);
  assert.equal(release.sensitive_field_not_returned, undefined);
  for (const mutate of [
    d => {d.draft = true;},
    d => {d.prerelease = true;},
    d => {d.tag_name = "latest";},
    d => {d.assets[0].browser_download_url = "https://evil.example/app.apk";},
    d => {d.assets[0].browser_download_url += "?download=1";},
    d => {d.assets[1].name = "unknown.sha256";},
    d => {d.assets[0].size = 0;},
    d => {d.assets[0].state = "new";}
  ]) {
    const invalid = fixture();
    mutate(invalid);
    assert.equal(validateOfficialRelease(invalid), null);
  }
});

test("read-only upstream transport fails closed on 404, errors and malformed metadata", async () => {
  const calls = [];
  const good = await readOfficialRelease(async (url, options) => {
    calls.push({url, options});
    return {status: 200, json: async () => fixture()};
  });
  assert.equal(good.status, 200);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "error");
  assert.match(calls[0].url, /api\.github\.com\/repos\/.*\/releases\/latest/);
  assert.equal((await readOfficialRelease(async () => ({status: 404}))).status, 404);
  assert.equal((await readOfficialRelease(async () => ({status: 429}))).status, 503);
  assert.equal((await readOfficialRelease(async () => {throw Error("network");})).status, 503);
  assert.equal((await readOfficialRelease(async () => ({status: 200, json: async () => ({})}))).status, 404);
});
