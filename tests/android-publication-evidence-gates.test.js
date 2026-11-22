import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/publicar-apk-android.yml', import.meta.url), 'utf8');

test('public release requires explicit authorization on main', () => {
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /PUBLICAR_APK_OFICIAL/);
  assert.match(workflow, /workflow_dispatch:/);
});
test('candidate 0.9.1 versionCode 2 cannot be overwritten by official release', () => {
  assert.match(workflow, /ANDROID_VERSION_CODE > 2/);
  assert.match(workflow, /versionCode='\$ANDROID_VERSION_CODE'/);
  assert.match(workflow, /gh release view/);
});
test('published asset is release-signed, certificate-pinned and checksummed', () => {
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /apksigner" verify --verbose/);
  assert.match(workflow, /actual_cert.*normalized_cert/);
  assert.match(workflow, /sha256sum -c/);
  assert.match(workflow, /gh release create/);
  assert.doesNotMatch(workflow, /assembleDebug|app-debug\.apk/);
});
test('release is blocked by backend and commercial payment gates', () => {
  assert.ok((workflow.match(/node scripts\/check-android-release-server\.mjs/g) ?? []).length >= 2);
  assert.ok((workflow.match(/node scripts\/check-commercial-store\.mjs/g) ?? []).length >= 2);
});
