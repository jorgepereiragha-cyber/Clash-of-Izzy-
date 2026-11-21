import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const activity = read('android-sideload/app/src/main/java/com/clashofizzy/android/MainActivity.java');
const manifest = read('android-sideload/app/src/main/AndroidManifest.xml');
const gradle = read('android-sideload/app/build.gradle');
const workflow = read('.github/workflows/android-apk.yml');

test('APK abre o jogo no mesmo Worker HTTPS de producao', () => {
  assert.match(activity, /https:\/\/clash-of-izzy\.jorgepereiragha\.workers\.dev\/kingdom\.html/);
  assert.match(activity, /isGameUrl\(uri\)/);
  assert.match(activity, /openOutsideApp\(uri\)/);
});
test('WebView bloqueia acesso a arquivos, mixed content e SSL invalido', () => {
  for (const item of [
    'settings.setAllowFileAccess(false)',
    'settings.setAllowContentAccess(false)',
    'settings.setAllowFileAccessFromFileURLs(false)',
    'settings.setAllowUniversalAccessFromFileURLs(false)',
    'settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)',
    'handler.cancel()'
  ]) assert.ok(activity.includes(item), item);
  assert.doesNotMatch(activity, /addJavascriptInterface\s*\(/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:hardwareAccelerated="true"/);
});
test('build de teste nao tem o mesmo ID da release e requer Android moderno', () => {
  assert.match(gradle, /applicationId 'com\.clashofizzy\.android'/);
  assert.match(gradle, /applicationIdSuffix '\.debug'/);
  assert.match(gradle, /minSdk 24/);
  assert.match(gradle, /targetSdk 35/);
});
test('release nunca e publicada unsigned e nao toca D1', () => {
  assert.match(workflow, /ANDROID_RELEASE_KEYSTORE_BASE64/);
  assert.match(workflow, /test -n "\$KEYSTORE_B64"/);
  assert.match(workflow, /apksigner" verify/);
  assert.doesNotMatch(workflow, /wrangler|d1 migrations|deploy-cloudflare/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});

test('APK client keeps city navigation and official game backend separate', () => {
  const city = read('kingdom.html');
  assert.match(city, /coi:command-state/);
  assert.match(city, /href="\/world\.html"/);
  assert.match(city, /src="\/scripts\/kingdom-command-hud\.js"/);
  assert.match(activity, /https:\/\/clash-of-izzy\.jorgepereiragha\.workers\.dev\/kingdom\.html/);
});
