import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const release = readFileSync(new URL('../.github/workflows/publicar-apk-android.yml', import.meta.url), 'utf8');

// Static fail-closed checks complement, but do not replace, Android device tests.
test('release runs only via manual confirmation on main', () => {
  assert.match(release, /workflow_dispatch:/);
  assert.match(release, /github\.ref == 'refs\/heads\/main'/);
  assert.match(release, /PUBLICAR_APK_OFICIAL/);
  assert.match(release, /\[\[ "\$RELEASE_CONFIRMATION" == "PUBLICAR_APK_OFICIAL" \]\]/);
});

test('release requires four secrets and pinned signing certificate', () => {
  for (const name of ['ANDROID_RELEASE_KEYSTORE_BASE64','ANDROID_RELEASE_STORE_PASSWORD','ANDROID_RELEASE_KEY_ALIAS','ANDROID_RELEASE_KEY_PASSWORD','ANDROID_RELEASE_CERT_SHA256']) {
    assert.ok(release.includes(name), name);
  }
  assert.match(release, /apksigner" verify --verbose/);
  assert.match(release, /apksigner" verify --print-certs/);
  assert.match(release, /\[\[ "\$actual_cert" == "\$normalized_cert" \]\]/);
});

test('release fails closed on backend and produces APK plus matching checksum', () => {
  const health = release.match(/node scripts\/check-android-release-server\.mjs/g) || [];
  assert.ok(health.length >= 2, 'backend must be checked before signing and before publication');
  assert.match(release, /sha256sum -c clash-of-izzy-android\.apk\.sha256/);
  assert.match(release, /gh release create "\$tag"/);
  assert.match(release, /\$RUNNER_TEMP\/clash-of-izzy-android\.apk\.sha256/);
  assert.doesNotMatch(release, /assembleDebug|app-debug\.apk|wrangler deploy|d1 migrations apply[^\n]*--remote/);
});

test('release never overwrites an existing version and checks package metadata', () => {
  assert.match(release, /gh release view "\$tag"/);
  assert.match(release, /name='com\.clashofizzy\.android'/);
  assert.match(release, /versionCode='\$ANDROID_VERSION_CODE'/);
  assert.match(release, /versionName='\$ANDROID_VERSION_NAME'/);
});
