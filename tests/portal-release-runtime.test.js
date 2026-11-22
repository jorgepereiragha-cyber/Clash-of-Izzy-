import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const repo = "jorgepereiragha-cyber/Clash-of-Izzy-";
const base = "https://github.com/" + repo + "/releases/download/v1/";
const apkName = "clash-of-izzy-android.apk";
const asset = (name, url = base + name) => ({ name, state: "uploaded", size: 100, browser_download_url: url });

async function render(release, responseOk = true) {
  const html = await readFile(new URL("../public-portal/portal.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
  assert.ok(script, "portal release script must exist");
  const nodes = Object.fromEntries(["download-apk", "download-status", "checksum-link"].map(id => {
    const attributes = new Map();
    return [id, {
      attributes, hidden: id === "checksum-link", textContent: "", href: undefined,
      setAttribute(key, value) { attributes.set(key, value); },
      removeAttribute(key) { attributes.delete(key); }
    }];
  }));
  const sandbox = {
    URL,
    document: { getElementById(id) { return nodes[id]; } },
    fetch: async () => ({ ok: responseOk, json: async () => release })
  };
  vm.runInNewContext(script, sandbox, { timeout: 1000 });
  await new Promise(resolve => setImmediate(resolve));
  return nodes;
}

test("portal libera somente release estável com APK e checksum oficiais", async () => {
  const nodes = await render({ draft: false, prerelease: false, tag_name: "v1", assets: [
    asset(apkName), asset(apkName + ".sha256")
  ] });
  assert.equal(nodes["download-apk"].href, base + apkName);
  assert.equal(nodes["download-apk"].attributes.has("aria-disabled"), false);
  assert.equal(nodes["checksum-link"].hidden, false);
});

test("portal não libera APK sem checksum", async () => {
  const nodes = await render({ draft: false, prerelease: false, assets: [asset(apkName)] });
  assert.equal(nodes["download-apk"].href, undefined);
  assert.equal(nodes["download-apk"].attributes.get("aria-disabled"), "true");
});

test("portal rejeita release preliminar ou rascunho", async () => {
  for (const flag of ["draft", "prerelease"]) {
    const nodes = await render({ draft: false, prerelease: false, [flag]: true, assets: [
      asset(apkName), asset(apkName + ".sha256")
    ] });
    assert.equal(nodes["download-apk"].href, undefined);
  }
});

test("portal rejeita download de domínio externo ou caminho incorreto", async () => {
  for (const url of [
    "https://evil.example/" + apkName,
    "https://github.com/another/repo/releases/download/v1/" + apkName,
    base + apkName + "?redirect=1"
  ]) {
    const nodes = await render({ draft: false, prerelease: false, assets: [
      asset(apkName, url), asset(apkName + ".sha256")
    ] });
    assert.equal(nodes["download-apk"].href, undefined);
  }
});

test("falha de consulta mantém download desabilitado", async () => {
  const nodes = await render(null, false);
  assert.equal(nodes["download-apk"].href, undefined);
  assert.equal(nodes["download-apk"].attributes.get("tabindex"), "-1");
});
