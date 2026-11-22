const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/publicar-apk-android.yml'), 'utf8');
function step(name) {
  const marker = `- name: ${name}`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing step: ${name}`);
  const next = workflow.indexOf('\n      - ', start + marker.length);
  return { index: start, body: workflow.slice(start, next < 0 ? undefined : next) };
}
test('release requires verified signed release APK and SHA-256 before publishing', () => {
  const build = step('Compilar release assinada');
  const verify = step('Verificar assinatura, tamanho e SHA-256');
  const publish = step('Publicar release oficial com APK e checksum');
  assert.ok(build.index < verify.index && verify.index < publish.index);
  assert.match(build.body, /assembleRelease/);
  assert.match(verify.body, /apksigner.*verify/);
  assert.match(verify.body, /actual_cert.*normalized_cert/);
  assert.match(verify.body, /sha256sum -c/);
  assert.match(publish.body, /clash-of-izzy-android\.apk\.sha256/);
  assert.doesNotMatch(publish.body, /debug\.apk|assembleDebug/);
});
test('release remains manual, main-only, and refuses to overwrite existing tag', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n  push:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(step('Validar autorizacao de publicacao e identificadores').body, /PUBLICAR_APK_OFICIAL/);
  assert.match(step('Validar autorizacao de publicacao e identificadores').body, /gh release view/);
});
test('private keystore cleanup runs even on failure', () => {
  const cleanup = step('Remover chave privada do runner');
  assert.match(cleanup.body, /if: always\(\)/);
  assert.match(cleanup.body, /rm -f/);
});

test('production backend and payment readiness are rechecked before official APK publication', () => {
  const backend = step('Revalidar backend imediatamente antes de disponibilizar APK');
  const payments = step('Revalidar catalogo e pagamentos imediatamente antes de liberar APK');
  const publish = step('Publicar release oficial com APK e checksum');
  assert.ok(backend.index < payments.index && payments.index < publish.index);
  assert.match(workflow, /ANDROID_RELEASE_KEYSTORE_BASE64/);
  assert.match(workflow, /ANDROID_RELEASE_STORE_PASSWORD/);
  assert.match(workflow, /ANDROID_RELEASE_KEY_ALIAS/);
  assert.match(workflow, /ANDROID_RELEASE_KEY_PASSWORD/);
  assert.match(workflow, /ANDROID_RELEASE_CERT_SHA256/);
});
