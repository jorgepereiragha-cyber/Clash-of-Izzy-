import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/publicar-apk-android.yml', import.meta.url), 'utf8');
const store = readFileSync(new URL('../scripts/check-commercial-store.mjs', import.meta.url), 'utf8');

test('release cannot be mistaken for payment reconciliation', () => {
  assert.match(store, /configura[cç][aã]o informada pelo backend n[aã]o comprova transa[cç][aã]o real/i);
  assert.match(workflow, /check-commercial-store\.mjs/);
});

test('current publication workflow is intentionally blocked until payment gates are resolved', () => {
  assert.match(store, /methods\.mercadoPago!==true/);
  assert.match(store, /methods\.nubankPix!==true/);
  assert.match(workflow, /Exigir todos pacotes e dois recebimentos habilitados/);
});

test('release requires permanent certificate and checksum even while payments remain disabled', () => {
  assert.match(workflow, /ANDROID_RELEASE_CERT_SHA256/);
  assert.match(workflow, /sha256sum -c/);
  assert.match(workflow, /gh release create/);
  assert.doesNotMatch(workflow, /assembleDebug/);
});
