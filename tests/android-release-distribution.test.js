import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('release Android requires main, explicit publication confirmation and permanent signing', () => {
  const flow = read('.github/workflows/publicar-apk-android.yml');
  assert.match(flow, /workflow_dispatch:/);
  assert.match(flow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(flow, /PUBLICAR_APK_OFICIAL/);
  assert.match(flow, /ANDROID_RELEASE_KEYSTORE_BASE64/);
  assert.match(flow, /ANDROID_RELEASE_STORE_PASSWORD/);
  assert.match(flow, /ANDROID_RELEASE_KEY_ALIAS/);
  assert.match(flow, /ANDROID_RELEASE_KEY_PASSWORD/);
  assert.match(flow, /assembleRelease/);
  assert.match(flow, /apksigner" verify --verbose/);
  // Falhar se certificado trocado ou se applicationId/versionCode/versionName divergem.
  assert.match(flow, /ANDROID_RELEASE_CERT_SHA256/);
  assert.match(flow, /actual_cert/);
  assert.match(flow, /normalized_cert/);
  assert.match(flow, /Certificado APK diferente do aprovado/);
  assert.match(flow, /com[.]clashofizzy[.]android/);
  assert.match(flow, /package_info/);
  assert.match(flow, /npm test/);
  assert.match(flow, /npm run test:e2e/);
  assert.match(flow, /gh release create/);
  assert.doesNotMatch(flow, /assembleDebug|wrangler deploy|d1 migrations apply .*--remote/);
});
test('published APK URL contract matches portal and includes SHA-256 asset', () => {
  const flow = read('.github/workflows/publicar-apk-android.yml');
  const portal = read('portal.html');
  const gradle = read('android-sideload/app/build.gradle');
  assert.match(flow, /clash-of-izzy-android\.apk\.sha256/);
  assert.match(flow, /clash-of-izzy-android\.apk/);
  assert.match(flow, /sha256sum -c/);
  assert.match(portal, /releases\/latest/);
  assert.match(portal, /clash-of-izzy-android\.apk/);
  assert.match(portal, /validAsset\(asset, filename/);
  assert.match(portal, /validAsset\(asset, filename \+ "\.sha256"/);
  assert.match(gradle, /ANDROID_VERSION_CODE/);
  assert.match(gradle, /ANDROID_VERSION_NAME/);
  assert.match(gradle, /versionCode androidVersionCode/);
  assert.match(gradle, /versionName androidVersionName/);
});
