import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const candidate = read(".github/workflows/android-candidate-apk.yml");
const debug = read(".github/workflows/android-apk.yml");
const activity = read("android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java");

test("APK debug para instalar e testar e criado automaticamente em alteracoes da main", () => {
  assert.match(debug, /push:\s*\n\s*branches: \[main\]/);
  assert.match(debug, /android-sideload\/\*\*/);
  assert.match(debug, /github\.event_name != 'workflow_dispatch' \|\| inputs\.tipo == 'teste'/);
  assert.match(debug, /assembleDebug/);
  assert.match(debug, /clash-of-izzy-android-apk-teste/);
});

test("Candidato assinado so executa na main com assinatura permanente", () => {
  assert.match(candidate, /push:\s*\n\s*branches: \[main\]/);
  assert.match(candidate, /github\.ref == 'refs\/heads\/main'/);
  assert.match(candidate, /git ls-remote origin refs\/heads\/main/);
  assert.match(candidate, /npm test/);
  for (const secret of ["ANDROID_RELEASE_KEYSTORE_BASE64", "ANDROID_RELEASE_STORE_PASSWORD",
    "ANDROID_RELEASE_KEY_ALIAS", "ANDROID_RELEASE_KEY_PASSWORD", "ANDROID_RELEASE_CERT_SHA256"]) {
    assert.ok(candidate.includes(secret), secret);
  }
  assert.match(candidate, /gradle --no-daemon assembleRelease/);
});

test("Candidato verifica certificado, pacote Android e checksum antes de arquivar", () => {
  assert.match(candidate, /apksigner" verify --verbose/);
  assert.match(candidate, /apksigner" verify --print-certs/);
  assert.match(candidate, /\"\$actual\" == \"\$expected\"/);
  assert.match(candidate, /com\.clashofizzy\.android/);
  assert.match(candidate, /sha256sum -c clash-of-izzy-android-candidato-interno\.apk\.sha256/);
  assert.match(candidate, /actions\/upload-artifact@v4/);
  assert.match(candidate, /clash-of-izzy-android-candidato-assinado/);
  assert.match(candidate, /rm -f "\$RUNNER_TEMP\/clash-izzy-candidate\.jks"/);
});

test("Candidato nao promove release comercial, pagamentos ou migracoes", () => {
  assert.doesNotMatch(candidate, /gh release create|wrangler\s+deploy|d1 migrations apply|cloudflare.*deploy/i);
  assert.doesNotMatch(candidate, /ANDROID_RELEASE_KEYSTORE_BASE64\s*=\s*[^{$\n ]+/);
  assert.match(candidate, /NAO publica GitHub Releases/);
  assert.match(candidate, /versionCode maior que 2/);
});

test("Login Google no APK nao tenta interpretar URL ausente do WebView", () => {
  assert.match(activity, /return uri != null && "https"\.equalsIgnoreCase/);
  assert.match(activity, /webView\.getUrl\(\) == null \|\| !isGameUrl/);
  assert.match(activity, /view\.getUrl\(\) != null && isGameUrl/);
});


test("Candidato 0.9.1 incrementa versionCode sem alterar identidade nem certificado", () => {
  assert.match(candidate, /ANDROID_VERSION_CODE: "2"/);
  assert.match(candidate, /ANDROID_VERSION_NAME: "0.9.1"/);
  assert.match(candidate, /versionCode maior que 2/);
  assert.match(candidate, /ANDROID_RELEASE_CERT_SHA256/);
});
